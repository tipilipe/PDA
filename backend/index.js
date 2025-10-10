// backend/index.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
// Force override so values from backend/.env replace any pre-existing env vars (common on Windows)
// Also ensure we load the .env that sits next to this file, even if the CWD is different
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


function buildConnFromPgPieces() {
  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  if (PGHOST && PGUSER && PGPASSWORD && PGDATABASE) {
    const port = PGPORT || '5432';
    return `postgres://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${port}/${PGDATABASE}`;
  }
  return null;
}

let pool = null;
const conn = process.env.DATABASE_URL
  || process.env.RAILWAY_DATABASE_URL
  || process.env.POSTGRES_URL
  || buildConnFromPgPieces();
const connSource = process.env.DATABASE_URL ? 'DATABASE_URL'
  : process.env.RAILWAY_DATABASE_URL ? 'RAILWAY_DATABASE_URL'
  : process.env.POSTGRES_URL ? 'POSTGRES_URL'
  : (conn ? 'PG* pieces' : null);
if (!conn) {
  console.error('Nenhuma URL de banco encontrada. Defina uma destas variáveis no backend/.env:');
  console.error('- DATABASE_URL (recomendado)');
  console.error('- RAILWAY_DATABASE_URL ou POSTGRES_URL');
  console.error('Ou então PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE');
  console.error('Exemplo Neon: DATABASE_URL=postgres://usuario:senha@host.neon.tech:5432/db?sslmode=require');
  console.error('Dica: no Windows, você pode já ter uma variável de ambiente DATABASE_URL vazia ou antiga definida no sistema. Com override=TRUE, tentamos usar o valor do .env.');
  process.exit(1);
}
try {
  pool = new Pool({
    connectionString: conn,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const u = new URL(conn);
    console.log(`[env] Fonte da conexão: ${connSource} -> ${u.hostname}/${u.pathname.replace(/^\\/,'')}`);
  } catch {}
} catch (e) {
  console.error('Falha ao inicializar Pool do Postgres. Verifique sua URL e SSL.', e);
  process.exit(1);
}

const PORT = process.env.PORT || 3001;
// Inicialização do schema auxiliar (idempotente)
async function initSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        is_admin BOOLEAN DEFAULT FALSE,
        allow_password_reset BOOLEAN DEFAULT FALSE,
        allow_company_name_edit BOOLEAN DEFAULT FALSE,
        visible_tabs JSONB DEFAULT '{}'::jsonb
      );
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS subtitle TEXT;
    `);
  } catch (e) {
    console.error('Erro ao inicializar schema admin_user_settings:', e);
  }
}

initSchema();
app.get('/', (req, res) => { res.json({ message: 'Bem-vindo à API do Sistema PDA!' }); });

// Rotas de Dados
const shipRoutes = require('./routes/ships')(pool);
app.use('/api/ships', shipRoutes);

const clientRoutes = require('./routes/clients')(pool);
app.use('/api/clients', clientRoutes);

const portRoutes = require('./routes/ports')(pool);
app.use('/api/ports', portRoutes);

const serviceRoutes = require('./routes/services')(pool);
app.use('/api/services', serviceRoutes);

const portServiceRoutes = require('./routes/portServices')(pool);
app.use('/api/port-services', portServiceRoutes);

const calculationRoutes = require('./routes/calculations')(pool);
app.use('/api/calculations', calculationRoutes);

const portRemarkRoutes = require('./routes/portRemarks')(pool);
app.use('/api/port-remarks', portRemarkRoutes);

const pilotageRoutes = require('./routes/pilotage')(pool);
app.use('/api/pilotage', pilotageRoutes);

const pdaRoutes = require('./routes/engine')(pool);
app.use('/api/pda', pdaRoutes);

// Perfil da empresa/usuário
const companyProfileRoutes = require('./routes/company')(pool);
app.use('/api/company', companyProfileRoutes);

// Rota de Autenticação
const authModule = require('./routes/auth');
const authRoutes = authModule(pool);
app.use('/api/auth', authRoutes);
// Endpoint utilitário para validar o token atual (/api/auth/me)
if (typeof authModule.meRoute === 'function') {
  authModule.meRoute(app);
}

// Rotas de Administração
const adminRoutes = require('./routes/admin')(pool);
app.use('/api/admin', adminRoutes);

// Rotas de Empresas (para administração)
const companiesAdminRoutes = require('./routes/companyAdmin')(pool);
app.use('/api/companies', companiesAdminRoutes);

// Dashboard
const dashboardRoutes = require('./routes/dashboard')(pool);
app.use('/api/dashboard', dashboardRoutes);

// Rota de IA (habilita se AI_SHIPS=1/true ou se houver chave do provedor configurada)
const aiEnabled = (() => {
  const flag = process.env.AI_SHIPS;
  if (typeof flag === 'string' && ['1','true','yes','on'].includes(flag.toLowerCase())) return true;
  const provider = (process.env.AI_PROVIDER || '').toLowerCase();
  if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) return true;
  if (provider === 'openai' && process.env.OPENAI_API_KEY) return true;
  return false;
})();
if (aiEnabled) {
  try {
    const aiVesselRoutes = require('./routes/aiVessel')();
    app.use('/api/ai/vessel', aiVesselRoutes);
    console.log('[ai] Rota /api/ai/vessel habilitada');
    // Endpoints de debug/fallback no index (para validação rápida)
    app.get('/api/ai/__debug', (req, res) => res.json({ ok: true, ai: true }));
    app.get('/api/ai/vessel/ping', (req, res) => res.json({ ok: true, route: 'ai/vessel (index)' }));
    app.post('/api/ai/vessel/ocr-demo', (req, res) => {
      if (process.env.AI_MOCK !== '1') return res.status(403).json({ error: 'Demo desativada.' });
      return res.json({ ok: true, data: {
        name: 'MV EXAMPLE', imo: '1234567', mmsi: '123456789', flag: 'PA', year: 2010,
        dwt: 50000, grt: 30000, net: 15000, loa: 200, beam: 32, draft: 12, depth: 18
      }});
    });
  } catch (e) {
    console.error('[ai] Falha ao inicializar rota /api/ai/vessel:', e.message);
  }
} else {
  console.log('[ai] Rota /api/ai/vessel desabilitada. Defina AI_SHIPS=1 ou configure AI_PROVIDER e a respectiva API key.');
}

// Servir arquivos estáticos do frontend
const path = require('path');
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
// Serve arquivos estáticos na rota /sistema (conforme configuração do Vite)
app.use('/sistema', express.static(frontendPath));

// Health check (inclui teste simples no banco)
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch (e) {
    res.status(500).json({ ok: false, db: false, error: e.message });
  }
});

// Fallback para SPA - todas as rotas não-API redirecionam para index.html
app.use('/sistema', (req, res, next) => {
  // Se é um arquivo estático, deixa o middleware de arquivos estáticos lidar
  if (req.url.includes('.')) {
    return next();
  }
  // Senão, serve o index.html para roteamento SPA
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/', (req, res) => {
  res.redirect('/sistema/');
});

const logRoutes = require('./routes/logs')(pool);
app.use('/api/logs', logRoutes);

app.listen(PORT, () => {
  console.log(`🎉 Servidor backend rodando com sucesso na porta ${PORT}`);
});