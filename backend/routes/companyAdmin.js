const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { createLog } = require('../models/log');

module.exports = (pool) => {
  const router = express.Router();

  // Lista empresas (simples)
  router.get('/', protect, async (req, res) => {
    try {
      const result = await pool.query('SELECT id, name, cnpj, address, active FROM companies ORDER BY name ASC');
      res.json(result.rows);
    } catch (e) {
      console.error('Erro ao listar empresas:', e);
      res.status(500).json({ error: 'Erro ao listar empresas.' });
    }
  });

  // Cria empresa
  router.post('/', protect, async (req, res) => {
    const { name, cnpj, address } = req.body;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
    try {
      const toUpper = (v) => (v == null ? null : String(v).trim().toUpperCase());
      const nameU = toUpper(name);
      const addrU = toUpper(address);
      const cnpjT = (cnpj == null || String(cnpj).trim() === '') ? null : String(cnpj).trim();
      const result = await pool.query(
        'INSERT INTO companies (name, cnpj, address, active) VALUES ($1, $2, $3, TRUE) RETURNING id, name, cnpj, address, active',
        [nameU, cnpjT, addrU]
      );
      await createLog(pool, {
        userId,
        username,
        action: 'create',
        entity: 'company',
        entityId: result.rows[0].id,
        details: JSON.stringify(result.rows[0])
      });
      res.status(201).json(result.rows[0]);
    } catch (e) {
      console.error('Erro ao criar empresa:', e);
      res.status(500).json({ error: 'Erro ao criar empresa.' });
    }
  });

  // Desativar empresa
  router.patch('/:id/deactivate', protect, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    try {
      const result = await pool.query('UPDATE companies SET active = FALSE WHERE id = $1 RETURNING id, name, active', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Empresa não encontrada.' });
      await createLog(pool, {
        userId,
        username,
        action: 'update',
        entity: 'company',
        entityId: id,
        details: JSON.stringify(result.rows[0])
      });
      res.json(result.rows[0]);
    } catch (e) {
      console.error('Erro ao desativar empresa:', e);
      res.status(500).json({ error: 'Erro ao desativar empresa.' });
    }
  });

  // Excluir empresa
  router.delete('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    try {
      // opcional: checagens de integridade antes de excluir
      await pool.query('DELETE FROM companies WHERE id = $1', [id]);
      await createLog(pool, {
        userId,
        username,
        action: 'delete',
        entity: 'company',
        entityId: id,
        details: null
      });
      res.json({ message: 'Empresa excluída com sucesso.' });
    } catch (e) {
      console.error('Erro ao excluir empresa:', e);
      res.status(500).json({ error: 'Erro ao excluir empresa.' });
    }
  });

  return router;
};
