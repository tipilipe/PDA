// backend/routes/aiVessel.js
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const { protect } = require('../middleware/authMiddleware');
const undici = require('undici');
const fetch = global.fetch || undici.fetch;

// Configurable in-memory rate limiter per user
const buckets = new Map(); // userId -> number[] timestamps (ms)
const RATE_WINDOW_MS = (() => {
  const ms = parseInt(process.env.AI_RATE_WINDOW_MS || '', 10);
  if (!Number.isNaN(ms) && ms > 0) return ms;
  const sec = parseInt(process.env.AI_RATE_WINDOW_SEC || '', 10);
  if (!Number.isNaN(sec) && sec > 0) return sec * 1000;
  return 60_000; // default 60s
})();
const RATE_MAX = (() => {
  const n = parseInt(process.env.AI_RATE_MAX || '', 10);
  if (!Number.isNaN(n)) return n; // 0 desativa limitador local
  return 12; // default 12
})();

function allow(userId) {
  const now = Date.now();
  const arr = buckets.get(userId) || [];
  const fresh = arr.filter(t => now - t < RATE_WINDOW_MS);
  if (RATE_MAX <= 0) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, resetInMs: RATE_WINDOW_MS };
  }
  const remaining = Math.max(0, RATE_MAX - fresh.length);
  if (fresh.length >= RATE_MAX) {
    // next reset occurs when the oldest fresh entry falls out of window
    const oldest = Math.min(...fresh);
    const resetInMs = Math.max(0, RATE_WINDOW_MS - (now - oldest));
    return { allowed: false, remaining: 0, resetInMs };
  }
  fresh.push(now);
  buckets.set(userId, fresh);
  return { allowed: true, remaining: Math.max(0, remaining - 1), resetInMs: RATE_WINDOW_MS };
}

function routerFactory() {
  const router = express.Router();
  const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
  router.get('/ping', (req, res) => res.json({ ok: true, route: 'ai/vessel' }));

  // Resultado em cache por 10 minutos para a mesma imagem (data URL ou URL)
  const resultCache = new Map(); // key -> { data, ts }
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const CACHE_MAX = 50;
  const getCacheKey = (u) => crypto.createHash('sha256').update(String(u)).digest('hex');
  const cacheGet = (key) => {
    const item = resultCache.get(key);
    if (!item) return null;
    if (Date.now() - item.ts > CACHE_TTL_MS) {
      resultCache.delete(key);
      return null;
    }
    return item.data;
  };
  const cacheSet = (key, data) => {
    resultCache.set(key, { data, ts: Date.now() });
    if (resultCache.size > CACHE_MAX) {
      // remove item mais antigo
      const firstKey = resultCache.keys().next().value;
      resultCache.delete(firstKey);
    }
  };

  // Limpeza de cache (apenas autenticado). Em desenvolvimento, aceita clear=all.
  router.post('/__clear_cache', protect, (req, res) => {
    const { imageDataUrl, imageUrl, clear } = req.body || {};
    if (clear === 'all' && process.env.NODE_ENV !== 'production') {
      resultCache.clear();
      return res.json({ ok: true, cleared: 'all' });
    }
    const url = typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:')
      ? imageDataUrl
      : (typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl) ? imageUrl : null);
    if (!url) return res.status(400).json({ ok: false, error: 'Informe imageDataUrl ou imageUrl para limpar.' });
    const key = getCacheKey(url);
    const existed = resultCache.delete(key);
    return res.json({ ok: true, cleared: existed ? 1 : 0 });
  });

  router.post('/ocr', protect, async (req, res) => {
    try {
      if (process.env.AI_MOCK === '1') {
        return res.json({ ok: true, data: {
          name: 'MV EXAMPLE', imo: '1234567', mmsi: '123456789', flag: 'PA', year: 2010,
          dwt: 50000, grt: 30000, net: 15000, loa: 200, beam: 32, draft: 12, depth: 18
        }});
      }
      // Provider config: openai (default) or openrouter
      const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
      const isOpenRouter = provider === 'openrouter';
      const baseUrl = isOpenRouter ? (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1') : 'https://api.openai.com/v1';
      const apiKey = isOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
      if (!apiKey) {
        const msg = isOpenRouter
          ? 'IA não configurada. Defina OPENROUTER_API_KEY no backend/.env.'
          : 'IA não configurada. Defina OPENAI_API_KEY no backend/.env.';
        return res.status(503).json({ error: msg });
      }
      const userId = req.user?.userId || req.user?.id || 'anon';
      const role = req.user?.role;
      const bypass = role === 'admin' || process.env.AI_RATE_BYPASS === '1';
      const rate = allow(userId);
      // Expor cabeçalhos de rate limit para o cliente
      res.set('X-RateLimit-Limit', String(RATE_MAX));
      res.set('X-RateLimit-Remaining', String(Math.max(0, rate.remaining)));
      const resetEpoch = Math.floor((Date.now() + rate.resetInMs) / 1000);
      res.set('X-RateLimit-Reset', String(resetEpoch));
      if (!rate.allowed && !bypass) {
        const retrySec = Math.max(1, Math.ceil(rate.resetInMs / 1000));
        res.set('Retry-After', String(retrySec));
        return res.status(429).json({
          error: 'Muitas solicitações para IA. Tente novamente em alguns segundos.',
          errorCode: 'local_rate',
          retryAfter: retrySec
        });
      }

      const { imageDataUrl, imageUrl } = req.body || {};
      const url = typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:')
        ? imageDataUrl
        : (typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl) ? imageUrl : null);
      if (!url) {
        return res.status(400).json({ error: 'Envie imageDataUrl (data URL) ou imageUrl (http/https).' });
      }

      const defaultModel = isOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';
      const imageDetail = process.env.AI_IMAGE_DETAIL || 'high';
      const payload = {
        model: process.env.AI_MODEL || defaultModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text: [
                  'Você é um extrator de dados de embarcações. Responda APENAS com um JSON válido com as chaves: name, imo, mmsi, flag, year, dwt, grt, net, loa, beam, draft, depth.\n',
                  '- Unidades: metros para loa (length overall), beam (breadth), draft (draught) e depth; toneladas métricas para dwt, grt (gross tonnage) e net (net tonnage/NT/NRT).\n',
                  '- Mapeamentos/Sinônimos comuns na imagem: Length overall = loa; Breadth/Beam = beam; Draught/Draft = draft; Depth = depth; Gross tonnage/GT/GRT = grt; Net tonnage/NT/NRT = net; Deadweight/Deadweight tonnage/DWT = dwt; Flag = flag; Year/Keel laid date (ano) = year.\n',
                  '- Se a imagem contiver os rótulos "Gross tonnage", "Net tonnage" e/ou "Deadweight tonnage", você DEVE retornar grt, net e dwt com os valores numéricos correspondentes.\n',
                  '- Para year, se houver uma data como "Keel laid date 21-06-2006", extraia o ano (ex.: 2006).\n',
                  '- Extraia os valores exatamente desses campos; não confunda draft (calado) com depth (pontal).\n',
                  '- Formato numérico: use ponto como separador decimal (ex: 24.80).\n',
                  '- Se um campo não aparecer na imagem, use null. Não invente valores.\n'
                ].join('')
              }
            ]
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extraia os campos do navio desta imagem e responda somente com um JSON válido.' },
              { type: 'image_url', image_url: { url, detail: imageDetail } }
            ]
          }
        ]
      };

      // Cache por imagem para evitar chamadas repetidas ao provider
      const cacheKey = getCacheKey(url);
      const cached = cacheGet(cacheKey);
      if (cached) {
        res.set('X-AI-Cache', 'HIT');
        return res.json({ ok: true, data: cached });
      }

      // Timeout de 20s para evitar travas
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 20_000);
      const fetchOpts = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: ac.signal
      };
      if (isOpenRouter) {
        // OpenRouter recomenda enviar HTTP-Referer e X-Title
        const siteUrl = process.env.OPENROUTER_SITE_URL || process.env.SITE_URL || 'http://localhost:5173';
        const appName = process.env.OPENROUTER_APP_NAME || 'PDA';
        fetchOpts.headers['HTTP-Referer'] = siteUrl;
        fetchOpts.headers['X-Title'] = appName;
      }
      if (process.env.AI_INSECURE_TLS === '1') {
        // Atenção: desativa a verificação TLS apenas para esta chamada (ambiente corporativo com proxy SSL)
        fetchOpts.dispatcher = new undici.Agent({ connect: { rejectUnauthorized: false } });
        if (process.env.AI_DEBUG === '1') console.warn('[ai] INSECURE TLS ativo para chamada OpenAI');
      }
      // Controle global de vazão (gate): concorrência e intervalo mínimo entre chamadas upstream
      const AI_CONCURRENCY = Math.max(1, parseInt(process.env.AI_CONCURRENCY || '1', 10) || 1);
      const AI_MIN_INTERVAL_MS = Math.max(0, parseInt(process.env.AI_MIN_INTERVAL_MS || '1200', 10) || 0);
      if (!router.__gate) {
        router.__gate = { active: 0, lastTs: 0, queue: [] };
      }
      const gate = router.__gate;
      const acquireGate = () => new Promise((resolve) => {
        const tryAcquire = () => {
          const now = Date.now();
          const canConcurrency = gate.active < AI_CONCURRENCY;
          const canInterval = now - gate.lastTs >= AI_MIN_INTERVAL_MS;
          if (canConcurrency && canInterval) {
            gate.active += 1;
            resolve(() => {
              gate.active = Math.max(0, gate.active - 1);
              gate.lastTs = Date.now();
            });
          } else {
            setTimeout(tryAcquire, 50);
          }
        };
        tryAcquire();
      });

      const release = await acquireGate();
      let r;
      try {
        r = await fetch(`${baseUrl}/chat/completions`, fetchOpts);
      } finally {
        clearTimeout(t);
        release();
      }

      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        const isRate = r.status === 429;
        if (isRate) {
          const retryHeader = r.headers.get('retry-after');
          if (retryHeader) res.set('Retry-After', retryHeader);
          // Propaga cabeçalhos de rate do provedor, quando existirem
          const rlLimit = r.headers.get('x-ratelimit-limit-requests');
          const rlRemain = r.headers.get('x-ratelimit-remaining-requests');
          const rlReset = r.headers.get('x-ratelimit-reset-requests');
          const reqId = r.headers.get('x-request-id');
          if (rlLimit) res.set('X-Upstream-RateLimit-Limit', rlLimit);
          if (rlRemain) res.set('X-Upstream-RateLimit-Remaining', rlRemain);
          if (rlReset) res.set('X-Upstream-RateLimit-Reset', rlReset);
          if (reqId) res.set('X-Upstream-Request-Id', reqId);
          // Tenta expor em segundos no corpo
          let retryAfterSec;
          if (retryHeader) {
            const n = parseInt(retryHeader, 10);
            if (!Number.isNaN(n)) {
              retryAfterSec = n;
            } else {
              const dateMs = Date.parse(retryHeader);
              if (!Number.isNaN(dateMs)) {
                retryAfterSec = Math.max(1, Math.ceil((dateMs - Date.now()) / 1000));
              }
            }
          }
          // Retry único opcional para 429 upstream
          const DO_RETRY = (process.env.AI_UPSTREAM_RETRY === '1');
          if (DO_RETRY) {
            const waitMs = Math.min(30_000, (retryAfterSec ? retryAfterSec * 1000 : 5_000));
            if (process.env.AI_DEBUG === '1') console.warn(`[ai] 429 upstream, aguardando ${waitMs}ms e tentando novamente...`);
            await new Promise(r => setTimeout(r, waitMs));
            // tentar novamente uma vez, passando pelo gate
            const ac2 = new AbortController();
            const t2 = setTimeout(() => ac2.abort(), 20_000);
            const fetchOpts2 = { ...fetchOpts, signal: ac2.signal };
            const release2 = await acquireGate();
            let r2;
            try {
              r2 = await fetch(`${baseUrl}/chat/completions`, fetchOpts2);
            } finally {
              clearTimeout(t2);
              release2();
            }
            if (r2.ok) {
              const data2 = await r2.json();
              const content2 = data2?.choices?.[0]?.message?.content;
              let parsed2 = null;
              try {
                parsed2 = content2 && typeof content2 === 'string' ? JSON.parse(content2) : content2;
              } catch {
                if (Array.isArray(content2)) {
                  const text2 = content2.map(p => p?.text).filter(Boolean).join('\n');
                  parsed2 = JSON.parse(text2);
                }
              }
              if (!parsed2 || typeof parsed2 !== 'object') {
                return res.status(502).json({ error: 'Resposta da IA inválida.' });
              }
              const safe2 = {
                name: parsed2.name ?? null,
                imo: parsed2.imo ?? null,
                mmsi: parsed2.mmsi ?? null,
                flag: parsed2.flag ?? null,
                year: parsed2.year ?? null,
                dwt: parsed2.dwt ?? null,
                grt: parsed2.grt ?? null,
                net: parsed2.net ?? null,
                loa: parsed2.loa ?? null,
                beam: parsed2.beam ?? null,
                draft: parsed2.draft ?? null,
                depth: parsed2.depth ?? null,
              };
              cacheSet(cacheKey, safe2);
              res.set('X-AI-Cache', 'MISS');
              return res.json({ ok: true, data: safe2 });
            }
            // se ainda 429, cai para a resposta padrão abaixo
          }

          const body = { error: 'Limite de uso atingido no provedor de IA. Tente novamente mais tarde.', errorCode: 'upstream_rate', details: txt.slice(0, 500) };
          if (retryAfterSec) body.retryAfter = retryAfterSec;
          return res.status(r.status).json(body);
        }
        const msg = `Falha na IA (${r.status}).`;
        return res.status(r.status).json({ error: msg, details: txt.slice(0, 500) });
      }
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content;
      let parsed = null;
      try {
        parsed = content && typeof content === 'string' ? JSON.parse(content) : content;
      } catch {
        // Alguns providers retornam como array de partes
        if (Array.isArray(content)) {
          const text = content.map(p => p?.text).filter(Boolean).join('\n');
          parsed = JSON.parse(text);
        }
      }
      if (!parsed || typeof parsed !== 'object') {
        return res.status(502).json({ error: 'Resposta da IA inválida.' });
      }

      // Normalização e mapeamento de sinônimos
      const pick = (...keys) => {
        for (const k of keys) {
          if (parsed[k] !== undefined && parsed[k] !== null && parsed[k] !== '') return parsed[k];
        }
        return null;
      };
      const toNum = (v, { integer = false } = {}) => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number' && Number.isFinite(v)) return integer ? Math.round(v) : v;
        if (typeof v !== 'string') return null;
        let s = v.trim();
        // Remove unidades e símbolos
        s = s.replace(/[,](?=\d{3}(\D|$))/g, ''); // remove separador de milhares com vírgula
        s = s.replace(/[\.](?=\d{3}(\D|$))/g, ''); // remove separador de milhares com ponto
        s = s.replace(/\s|m|meters?|tonnes?|t|GT|NT|DWT|\(|\)|\[|\]|:|=/gi, '');
        s = s.replace(',', '.'); // decimal vírgula -> ponto
        const num = parseFloat(s);
        if (!Number.isFinite(num)) return null;
        return integer ? Math.round(num) : num;
      };
      const clampYear = (y) => {
        if (y === null || y === undefined) return null;
        const now = new Date().getFullYear();
        if (typeof y === 'number' && Number.isFinite(y)) {
          const n = Math.round(y);
          return (n >= 1900 && n <= now + 1) ? n : null;
        }
        if (typeof y === 'string') {
          const m = y.match(/(?<!\d)(19|20)\d{2}(?!\d)/);
          if (m) {
            const n = parseInt(m[0], 10);
            if (n >= 1900 && n <= now + 1) return n;
          }
        }
        const n = toNum(y, { integer: true });
        if (!n) return null;
        return (n >= 1900 && n <= now + 1) ? n : null;
      };
      const cleanText = (s) => {
        if (typeof s !== 'string') return s ?? null;
        const t = s.trim();
        return t || null;
      };
      const cleanFlag = (s) => {
        const t = cleanText(s);
        if (!t) return null;
        return t.length <= 3 ? t.toUpperCase() : t; // aceita código curto ou nome por extenso
      };
      const cleanImo = (s) => {
        const digits = String(s ?? '').replace(/\D/g, '');
        return digits.length >= 7 ? digits.slice(0, 7) : (digits || null);
      };

      let name = cleanText(pick('name', 'vessel', 'ship_name'));
      let imo = cleanImo(pick('imo', 'imo_number'));
      let mmsi = pick('mmsi');
      let flag = cleanFlag(pick('flag', 'country'));
      let year = clampYear(pick('year', 'built', 'keel_year'));

  let dwt = toNum(pick('dwt', 'deadweight', 'deadweight_tonnage'), { integer: true });
  let grt = toNum(pick('grt', 'gt', 'gross_tonnage', 'gross_register_tonnage', 'grt_register'), { integer: true });
  let net = toNum(pick('net', 'nt', 'nrt', 'net_tonnage', 'net_register_tonnage', 'nrt_tonnage'), { integer: true });

      let loa = toNum(pick('loa', 'length_overall', 'length'), {});
      let beam = toNum(pick('beam', 'breadth', 'width'), {});
      let draft = toNum(pick('draft', 'draught'), {});
      let depth = toNum(pick('depth', 'depth_moulded', 'moulded_depth'), {});

      // Heurística: se draft > 0, depth > 0 e depth < draft, é provável que inverteram
      if (draft && depth && depth < draft) {
        const tmp = draft; draft = depth; depth = tmp;
      }

  // Regras de saneamento final
  const round2 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : n);
  loa = round2(loa); beam = round2(beam); draft = round2(draft); depth = round2(depth);

  const warnings = [];
  const pushWarn = (k, msg) => warnings.push({ field: k, message: msg });

  const yrNow = new Date().getFullYear();
  if (year && (year < 1900 || year > yrNow + 1)) { pushWarn('year', 'Ano fora do intervalo plausível'); year = null; }
  const range = (v, min, max, k) => { if (v != null && (v < min || v > max)) { pushWarn(k, `Valor fora do intervalo (${min}-${max})`); return null; } return v; };
  dwt = range(dwt, 100, 600000, 'dwt');
  grt = range(grt, 100, 400000, 'grt');
  net = range(net, 50, 300000, 'net');
  loa = range(loa, 10, 500, 'loa');
  beam = range(beam, 2, 80, 'beam');
  draft = range(draft, 0, 30, 'draft');
  depth = range(depth, 0, 50, 'depth');

  const safe = { name, imo, mmsi, flag, year, dwt, grt, net, loa, beam, draft, depth };

  // Armazena em cache
  cacheSet(cacheKey, safe);
  res.set('X-AI-Cache', 'MISS');
  return res.json({ ok: true, data: safe, warnings });
    } catch (e) {
      console.error('Erro no OCR de navio:', e);
      const code = e?.code || e?.name || '';
      const msg = (e?.message || '').toLowerCase();
      const isSelfSigned = code === 'SELF_SIGNED_CERT_IN_CHAIN' || msg.includes('self-signed certificate');
      const isNetwork = isSelfSigned || ['ENOTFOUND','ECONNREFUSED','ECONNRESET','ETIMEDOUT','AbortError'].includes(code);
      const status = isNetwork ? 502 : 500;
      const body = { error: isNetwork ? 'Falha de rede ao contatar o provedor de IA.' : 'Erro interno ao processar a IA.' };
      if (isSelfSigned) {
        body.hint = 'Cadeia TLS interceptada (self-signed). Em desenvolvimento, defina AI_INSECURE_TLS=1 no backend/.env e reinicie.';
      }
      if (process.env.AI_DEBUG === '1') {
        body.details = e?.message || String(e);
        if (code) body.code = code;
      }
      return res.status(status).json(body);
    }
  });

  // Alternativa: upload multipart com resize server-side para reduzir payload
  router.post('/upload', protect, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo de imagem ausente.' });
      // Redimensiona para largura máxima 1600px, mantém proporção, converte para JPEG qualidade 80
      const buf = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
      req.body = { imageDataUrl: dataUrl };
      // Reutiliza a lógica do /ocr sem duplicar código: chama handler acima indiretamente
      // Para isso, podemos simplesmente retornar a mesma função utilitária
      // mas aqui vamos responder chamando o provider novamente de forma direta
      // Simplificação: reaproveitar fetch do provider com dataUrl

      // Pequeno truque: encamina internamente para /ocr
      req.url = '/ocr';
      return router.handle(req, res);
    } catch (e) {
      console.error('Falha no upload/resize de imagem:', e);
      return res.status(500).json({ error: 'Falha ao processar imagem enviada.' });
    }
  });

  // Endpoint de demonstração sem auth (somente quando AI_MOCK=1)
  router.post('/ocr-demo', async (req, res) => {
    if (process.env.AI_MOCK !== '1') {
      return res.status(403).json({ error: 'Demo desativada. Habilite AI_MOCK=1 no backend/.env.' });
    }
    return res.json({ ok: true, data: {
      name: 'MV EXAMPLE', imo: '1234567', mmsi: '123456789', flag: 'PA', year: 2010,
      dwt: 50000, grt: 30000, net: 15000, loa: 200, beam: 32, draft: 12, depth: 18
    }});
  });

  return router;
}

module.exports = routerFactory;
