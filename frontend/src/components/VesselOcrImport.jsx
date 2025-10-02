// frontend/src/components/VesselOcrImport.jsx
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

export default function VesselOcrImport({ onApply }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const fileRef = useRef(null);
  const autoRetryRef = useRef(false);

  const toDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Estimate bytes from a base64 data URL
  const estimateBytes = (dataUrl) => {
    try {
      const i = dataUrl.indexOf('base64,');
      if (i === -1) return dataUrl.length;
      const b64 = dataUrl.slice(i + 7);
      // 3/4 ratio for base64; ignore padding +/- small error is fine
      return Math.ceil((b64.length * 3) / 4);
    } catch { return dataUrl?.length || 0; }
  };

  // Compress an image data URL to stay below targetBytes. Prioritize quality reduction, then scale.
  const compressDataUrl = (dataUrl, targetBytes = 70_000) => new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        let scale = 1.0;
        let quality = 0.85;
        let best = dataUrl;

        const attempt = () => {
          const w = Math.max(1, Math.floor(img.width * scale));
          const h = Math.max(1, Math.floor(img.height * scale));
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL('image/jpeg', quality);
          if (estimateBytes(out) <= targetBytes || (quality <= 0.5 && scale <= 0.5)) {
            resolve(out);
          } else {
            // reduce quality until 0.5, then start reducing scale
            if (quality > 0.5) {
              quality -= 0.1;
            } else {
              scale *= 0.8;
            }
            requestAnimationFrame(attempt);
          }
        };
        attempt();
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch { resolve(dataUrl); }
  });

  const maybeCompress = async (dataUrl) => {
    const bytes = estimateBytes(dataUrl);
    // Many shared hosts/WAFs have strict JSON body limits (sometimes ~64–100KB). Keep margin.
    if (bytes > 70_000) {
      const compact = await compressDataUrl(dataUrl, 70_000);
      return compact;
    }
    return dataUrl;
  };

  const onPick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    try {
      let dataUrl = await toDataUrl(f);
      dataUrl = await maybeCompress(dataUrl);
      setPreview(dataUrl);
    } catch (err) {
      setError('Falha ao ler a imagem.');
    }
  };

  const onPaste = async (e) => {
    try {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type?.startsWith('image/')) {
          const file = it.getAsFile();
          let dataUrl = await toDataUrl(file);
          dataUrl = await maybeCompress(dataUrl);
          setPreview(dataUrl);
          break;
        }
      }
    } catch (err) {
      setError('Não foi possível colar a imagem.');
    }
  };

  const callAi = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('pda_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(`${API_BASE}/api/ai/vessel/ocr`, { imageDataUrl: preview }, { headers });
      if (!data?.ok) throw new Error('Resposta inválida da IA');
      if (onApply) onApply(data.data);
      // Mostra eventuais avisos (campos fora de faixa etc.)
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        const txt = data.warnings.map(w => `${w.field}: ${w.message}`).join(' | ');
        setError(`Avisos: ${txt}`);
      } else {
        setError(null);
      }
      // Limpa cache para esta imagem e remove preview (fluxo desejado)
      try {
        await axios.post(`${API_BASE}/api/ai/vessel/__clear_cache`, { imageDataUrl: preview }, { headers });
      } catch {}
      setPreview(null);
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error || err?.message;
      if (status === 401 || status === 403) {
        setError('Sessão não autorizada. Faça login novamente.');
      } else if (status === 404) {
        setError('Recurso de IA não encontrado no servidor (AI_SHIPS desativado?).');
      } else if (status === 429) {
        const code = err?.response?.data?.errorCode; // 'local_rate' ou 'upstream_rate'
        const rh = err?.response?.headers || {};
        const retryAfterStr = rh['retry-after'] ?? rh['Retry-After'] ?? err?.response?.data?.retryAfter;
        const retryAfter = parseInt(retryAfterStr, 10);
        if (code === 'upstream_rate') {
          setError('Limite de uso do provedor de IA atingido. Tente novamente mais tarde.');
        } else {
          setError('Muitas solicitações para IA. Tente novamente em alguns segundos.');
        }
        // Auto-retry uma vez para rate local, se a espera for curta (<= 15s)
        if ((code === 'local_rate' || code === 'upstream_rate') && Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 15 && !autoRetryRef.current) {
          autoRetryRef.current = true;
          setCooldownSec(retryAfter);
          const interval = setInterval(() => {
            setCooldownSec((s) => {
              const n = (s || 0) - 1;
              if (n <= 0) {
                clearInterval(interval);
              }
              return Math.max(0, n);
            });
          }, 1000);
          setTimeout(() => {
            autoRetryRef.current = false;
            callAi();
          }, retryAfter * 1000);
        }
      } else if (status === 503) {
        setError('IA não configurada no servidor.');
      } else if (status === 413) {
        // Attempt an automatic stronger compression once, then retry
        if (!autoRetryRef.current && preview) {
          autoRetryRef.current = true;
          try {
            const smaller = await compressDataUrl(preview, 40_000);
            setPreview(smaller);
            const token = localStorage.getItem('pda_token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const { data } = await axios.post(`${API_BASE}/api/ai/vessel/ocr`, { imageDataUrl: smaller }, { headers });
            if (!data?.ok) throw new Error('Resposta inválida da IA');
            if (onApply) onApply(data.data);
            if (Array.isArray(data.warnings) && data.warnings.length > 0) {
              const txt = data.warnings.map(w => `${w.field}: ${w.message}`).join(' | ');
              setError(`Avisos: ${txt}`);
            } else {
              setError(null);
            }
            try { await axios.post(`${API_BASE}/api/ai/vessel/__clear_cache`, { imageDataUrl: smaller }, { headers }); } catch {}
            setPreview(null);
            return; // success after retry
          } catch (e2) {
            setError('Imagem muito grande. Tente reduzir o tamanho.');
          } finally {
            autoRetryRef.current = false;
          }
        } else {
          setError('Imagem muito grande. Tente reduzir o tamanho.');
        }
      } else {
        setError(`Falha ao processar a IA: ${serverMsg || 'erro desconhecido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }} onPaste={onPaste}>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display:'none' }} />
      <button className="header-btn" type="button" onClick={() => fileRef.current?.click()}>
        Escolher imagem
      </button>
      <button className="header-btn" type="button" onClick={callAi} disabled={!preview || loading || cooldownSec > 0}>
        {loading ? 'Processando…' : (cooldownSec > 0 ? `Aguardando ${cooldownSec}s…` : 'Importar por IA')}
      </button>
      {preview && <img src={preview} alt="preview" style={{ height:40, borderRadius:6, border:'1px solid #333' }} />}
      {error && (
        <span style={{ color:'salmon' }}>
          {error} {String(error).includes('Sessão não autorizada') && (
            <a href="login" style={{ color:'#1976d2', marginLeft: 6 }}>Fazer login</a>
          )}
        </span>
      )}
      <span style={{ opacity:0.75 }}>Dica: você pode colar (Ctrl+V) uma captura diretamente aqui.</span>
    </div>
  );
}
