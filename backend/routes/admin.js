const express = require('express');
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/authMiddleware');
const { createLog } = require('../models/log');

module.exports = (pool) => {
  const router = express.Router();

  const ensureAdmin = (req, res, next) => {
    const role = req.user?.role;
    if (role === 'admin' || role === 'ADMIN' || role === 'superadmin') return next();
    return res.status(403).json({ error: 'Acesso negado: requer perfil de administrador.' });
  };

  // Lista usuários de todas as empresas (com nome da empresa)
  router.get('/users', protect, ensureAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.company_id, c.name AS company_name
        FROM users u
        LEFT JOIN companies c ON c.id = u.company_id
        ORDER BY c.name NULLS LAST, u.name ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
      res.status(500).json({ error: 'Erro interno ao listar usuários.' });
    }
  });

  // Cria um novo usuário na empresa atual
  router.post('/users', protect, ensureAdmin, async (req, res) => {
    const { companyId: adminCompanyId } = req.user;
    const { name, email, password, isAdmin, companyId } = req.body;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }
    try {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      const role = isAdmin ? 'admin' : 'user';
      // Define empresa: a selecionada no formulário, se válida; caso contrário, a do admin atual
      let targetCompanyId = parseInt(companyId, 10);
      if (!Number.isInteger(targetCompanyId)) targetCompanyId = adminCompanyId;
      const check = await pool.query('SELECT id FROM companies WHERE id = $1', [targetCompanyId]);
      if (check.rowCount === 0) targetCompanyId = adminCompanyId;

      const query = `INSERT INTO users (name, email, password_hash, company_id, role)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, name, email, role`;
      const result = await pool.query(query, [name, email, password_hash, targetCompanyId, role]);
      await createLog(pool, {
        userId,
        username,
        action: 'create',
        entity: 'user',
        entityId: result.rows[0].id,
        details: JSON.stringify(result.rows[0])
      });
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      res.status(500).json({ error: 'Erro interno ao criar usuário. Verifique se o email já está em uso.' });
    }
  });

  // Atualiza nome/role de um usuário (admin pode editar qualquer usuário)
  router.put('/users/:id', protect, ensureAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, role } = req.body;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    try {
      const result = await pool.query(
        'UPDATE users SET name = COALESCE($1, name), role = COALESCE($2, role) WHERE id = $3 RETURNING id, name, email, role, company_id',
        [name || null, role || null, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      await createLog(pool, {
        userId,
        username,
        action: 'update',
        entity: 'user',
        entityId: id,
        details: JSON.stringify(result.rows[0])
      });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
      res.status(500).json({ error: 'Erro interno ao atualizar usuário.' });
    }
  });

  // Reset de senha
  router.post('/users/:id/reset-password', protect, ensureAdmin, async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    if (!password) return res.status(400).json({ error: 'Senha é obrigatória.' });
    try {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      const result = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id', [password_hash, id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      await createLog(pool, {
        userId,
        username,
        action: 'update',
        entity: 'user',
        entityId: id,
        details: 'password reset (admin)'
      });
      res.json({ message: 'Senha redefinida com sucesso.' });
    } catch (err) {
      console.error('Erro ao redefinir senha:', err);
      res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
    }
  });

  // Métricas simples por empresa
  router.get('/metrics', protect, ensureAdmin, async (req, res) => {
    const { companyId } = req.user;
    try {
      const [ships, clients, pdas] = await Promise.all([
        pool.query('SELECT COUNT(*) AS c FROM ships WHERE company_id = $1', [companyId]),
        pool.query('SELECT COUNT(*) AS c FROM clients WHERE company_id = $1', [companyId]),
        pool.query('SELECT COUNT(*) AS c FROM pdas WHERE company_id = $1', [companyId]).catch(() => ({ rows: [{ c: 0 }] })),
      ]);
      res.json({
        ships: Number(ships.rows[0].c || 0),
        clients: Number(clients.rows[0].c || 0),
        pdas: Number((pdas.rows && pdas.rows[0]?.c) || 0),
      });
    } catch (err) {
      console.error('Erro ao obter métricas:', err);
      res.status(500).json({ error: 'Erro interno ao obter métricas.' });
    }
  });

  // Configurações do próprio usuário (sem necessidade de admin)
  router.get('/self/settings', protect, async (req, res) => {
    const { userId, companyId } = req.user;
    try {
      const result = await pool.query('SELECT * FROM admin_user_settings WHERE user_id = $1', [userId]);
      const row = result.rows[0] || { user_id: Number(userId), company_id: companyId, is_admin: false, allow_password_reset: false, allow_company_name_edit: false, visible_tabs: {} };
      res.json(row);
    } catch (e) {
      console.error('Erro ao buscar self settings:', e);
      res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
  });

  // Configurações por usuário (flags e abas visíveis)
  router.get('/users/:id/settings', protect, ensureAdmin, async (req, res) => {
    const { companyId } = req.user;
    const { id } = req.params;
    try {
      const result = await pool.query('SELECT * FROM admin_user_settings WHERE user_id = $1', [id]);
      const row = result.rows[0] || { user_id: Number(id), company_id: companyId, is_admin: false, allow_password_reset: false, allow_company_name_edit: false, visible_tabs: {} };
      res.json(row);
    } catch (e) {
      console.error('Erro ao buscar settings:', e);
      res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
  });

  router.put('/users/:id/settings', protect, ensureAdmin, async (req, res) => {
    const { id } = req.params;
    const { is_admin, allow_password_reset, allow_company_name_edit, visible_tabs } = req.body;
    try {
      // Preserva valores existentes quando não enviados e usa a empresa real do usuário
      const currentSettings = await pool.query('SELECT * FROM admin_user_settings WHERE user_id = $1', [id]);
      const current = currentSettings.rows[0] || {};
      const userRow = await pool.query('SELECT company_id FROM users WHERE id = $1', [id]);
      const targetCompanyId = userRow.rows[0]?.company_id ?? current.company_id;

      const nextIsAdmin = (typeof is_admin === 'boolean') ? is_admin : !!current.is_admin;
      const nextAllowPwd = (typeof allow_password_reset === 'boolean') ? allow_password_reset : !!current.allow_password_reset;
      const nextAllowCompanyName = (typeof allow_company_name_edit === 'boolean') ? allow_company_name_edit : !!current.allow_company_name_edit;
      const nextVisibleTabs = (visible_tabs !== undefined) ? visible_tabs : (current.visible_tabs || {});

      const upsert = `
        INSERT INTO admin_user_settings (user_id, company_id, is_admin, allow_password_reset, allow_company_name_edit, visible_tabs)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          company_id = EXCLUDED.company_id,
          is_admin = EXCLUDED.is_admin,
          allow_password_reset = EXCLUDED.allow_password_reset,
          allow_company_name_edit = EXCLUDED.allow_company_name_edit,
          visible_tabs = EXCLUDED.visible_tabs
        RETURNING *;
      `;
      const result = await pool.query(upsert, [id, targetCompanyId, !!nextIsAdmin, !!nextAllowPwd, !!nextAllowCompanyName, nextVisibleTabs]);
      if (typeof is_admin === 'boolean') {
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', [is_admin ? 'admin' : 'user', id]);
      }
      res.json(result.rows[0]);
    } catch (e) {
      console.error('Erro ao salvar configurações:', e);
      res.status(500).json({ error: 'Erro ao salvar configurações.' });
    }
  });

  // Vincular usuário a uma empresa existente
  router.post('/users/:id/company', protect, ensureAdmin, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.body;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    try {
      const result = await pool.query('UPDATE users SET company_id = $1 WHERE id = $2 RETURNING id, name, email, role, company_id', [companyId, id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      await createLog(pool, {
        userId,
        username,
        action: 'update',
        entity: 'user',
        entityId: id,
        details: JSON.stringify(result.rows[0])
      });
      res.json(result.rows[0]);
    } catch (e) {
      console.error('Erro ao vincular empresa:', e);
      res.status(500).json({ error: 'Erro ao vincular usuário à empresa.' });
    }
  });

  // Excluir usuário
  router.delete('/users/:id', protect, ensureAdmin, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    try {
      // remover settings juntos por FK ON DELETE CASCADE, mas garante se não houver
      await pool.query('DELETE FROM admin_user_settings WHERE user_id = $1', [id]).catch(() => {});
      const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      await createLog(pool, {
        userId,
        username,
        action: 'delete',
        entity: 'user',
        entityId: id,
        details: null
      });
      res.json({ message: 'Usuário excluído com sucesso.' });
    } catch (e) {
      console.error('Erro ao excluir usuário:', e);
      res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
  });

  return router;
};
