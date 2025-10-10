// backend/routes/company.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  const buildBankDetailsText = (obj) => {
    if (!obj || typeof obj === 'string') return obj || '';
    const safe = (v) => (v == null ? '' : String(v).trim());
    const lines = [];
    if (safe(obj.bank_name)) lines.push(`BANK: ${safe(obj.bank_name)}`);
    if (safe(obj.agency)) lines.push(`AGENCY: ${safe(obj.agency)}`);
    if (safe(obj.account)) lines.push(`ACCOUNT: ${safe(obj.account)}`);
    if (safe(obj.iban)) lines.push(`IBAN: ${safe(obj.iban)}`);
    if (safe(obj.swift)) lines.push(`SWIFT: ${safe(obj.swift)}`);
    return lines.join('\n');
  };
  // GET: Busca os dados da empresa e do usuário logado
  router.get('/profile', protect, async (req, res) => {
    const { companyId, userId } = req.user;
    try {
      const companyQuery = 'SELECT * FROM companies WHERE id = $1';
      const userQuery = 'SELECT id, name, email FROM users WHERE id = $1';

      const [companyRes, userRes] = await Promise.all([
        pool.query(companyQuery, [companyId]),
        pool.query(userQuery, [userId]),
      ]);

      if (companyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Empresa não encontrada.' });
      }

      // Normaliza bank_details_* para TEXTO para manter compatibilidade com front
      const row = { ...companyRes.rows[0] };
      const toText = (val) => (typeof val === 'object' && val !== null) ? buildBankDetailsText(val) : (val || '');
      row.bank_details_1 = toText(row.bank_details_1);
      row.bank_details_2 = toText(row.bank_details_2);
      row.bank_details_3 = toText(row.bank_details_3);

      res.json({
        company: row,
        user: userRes.rows[0]
      });
    } catch (err) {
      console.error('Erro ao buscar perfil:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // PUT: Atualiza os dados do perfil
  router.put('/profile', protect, async (req, res) => {
    const { companyId, userId } = req.user;
    const { company, user } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Atualiza os dados do usuário (apenas o nome)
      await client.query('UPDATE users SET name = $1 WHERE id = $2 AND company_id = $3', [user.name, userId, companyId]);
      
      // Atualiza os dados da empresa
      // Monta UPDATE compatível com esquema atual (subtitle pode não existir)
      const hasSubtitle = await client
        .query(`select 1 from information_schema.columns where table_schema='public' and table_name='companies' and column_name='subtitle'`)
        .then(r => r.rowCount > 0)
        .catch(() => false);
      // Se o nome da empresa ainda não foi definido, permite a inserção
      const currentCompany = await client.query('SELECT name FROM companies WHERE id = $1', [companyId]);
      if (!currentCompany.rows[0].name) {
        if (company?.name) {
          await client.query('UPDATE companies SET name = $1 WHERE id = $2', [company.name, companyId]);
        }
      } else {
        // Caso o admin tenha liberado edição de nome da empresa para este usuário, permite e consome a liberação
        try {
          const flagRes = await client.query('SELECT allow_company_name_edit FROM admin_user_settings WHERE user_id = $1', [userId]);
          if (flagRes.rows[0]?.allow_company_name_edit && company?.name && company.name !== currentCompany.rows[0].name) {
            await client.query('UPDATE companies SET name = $1 WHERE id = $2', [company.name, companyId]);
            await client.query('UPDATE admin_user_settings SET allow_company_name_edit = FALSE WHERE user_id = $1', [userId]);
          }
        } catch (e) {
          // Tabela admin_user_settings pode não existir; ignorar silenciosamente
        }
      }

      // Detecta se bank_details_* são JSON (json/jsonb)
      const bankIsJson = await client
        .query(`select data_type from information_schema.columns where table_schema='public' and table_name='companies' and column_name='bank_details_1'`)
        .then(r => (r.rows[0]?.data_type || '').includes('json'))
        .catch(() => false);

      const toBankObject = (raw) => {
        if (!raw) return {};
        if (typeof raw === 'object') return raw;
        const obj = {};
        String(raw).split('\n').forEach(line => {
          const [k, ...rest] = line.split(':');
          const val = rest.join(':').trim();
          if (/BANK/i.test(k)) obj.bank_name = val;
          if (/AGENC/i.test(k)) obj.agency = val;
          if (/ACCOUNT|CONTA/i.test(k)) obj.account = val;
          if (/IBAN/i.test(k)) obj.iban = val;
          if (/SWIFT/i.test(k)) obj.swift = val;
        });
        return obj;
      };

      const bank1Text = buildBankDetailsText(company.bank_details_1);
      const bank2Text = buildBankDetailsText(company.bank_details_2);
      const bank3Text = buildBankDetailsText(company.bank_details_3);

      const bank1Param = bankIsJson ? JSON.stringify(toBankObject(company.bank_details_1)) : (bank1Text && bank1Text.trim() ? bank1Text : '');
      const bank2Param = bankIsJson ? JSON.stringify(toBankObject(company.bank_details_2)) : (bank2Text && bank2Text.trim() ? bank2Text : '');
      const bank3Param = bankIsJson ? JSON.stringify(toBankObject(company.bank_details_3)) : (bank3Text && bank3Text.trim() ? bank3Text : '');

      if (hasSubtitle) {
        const q = `
          UPDATE companies
          SET 
            cnpj = $1,
            address = $2,
            logo_url = $3,
            bank_details_1 = $4,
            bank_details_2 = $5,
            bank_details_3 = $6,
            subtitle = $7
          WHERE id = $8
          RETURNING *;
        `;
        await client.query(q, [
          company.cnpj,
          company.address,
          company.logo_url,
          bank1Param,
          bank2Param,
          bank3Param,
          company.subtitle,
          companyId
        ]);
      } else {
        const q = `
          UPDATE companies
          SET 
            cnpj = $1,
            address = $2,
            logo_url = $3,
            bank_details_1 = $4,
            bank_details_2 = $5,
            bank_details_3 = $6
          WHERE id = $7
          RETURNING *;
        `;
        await client.query(q, [
          company.cnpj,
          company.address,
          company.logo_url,
          bank1Param,
          bank2Param,
          bank3Param,
          companyId
        ]);
      }

      await client.query('COMMIT');
      res.json({ message: 'Perfil atualizado com sucesso!' });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao atualizar perfil:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      client.release();
    }
  });

  return router;
};