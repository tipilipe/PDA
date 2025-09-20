// backend/index.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
const authRoutes = require('./routes/auth')(pool);
app.use('/api/auth', authRoutes);

// Rotas de Administração
const adminRoutes = require('./routes/admin')(pool);
app.use('/api/admin', adminRoutes);

// Rotas de Empresas (para administração)
const companiesAdminRoutes = require('./routes/companyAdmin')(pool);
app.use('/api/companies', companiesAdminRoutes);

app.listen(PORT, () => {
  console.log(`🎉 Servidor backend rodando com sucesso na porta ${PORT}`);
});