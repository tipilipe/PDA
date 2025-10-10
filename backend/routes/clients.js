// backend/routes/clients.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createLog } = require('../models/log');

module.exports = (pool) => {
  // Rota GET (sem alterações)
  router.get('/', protect, async (req, res) => {
    const companyId = req.user.companyId;
    try {
      const result = await pool.query('SELECT * FROM clients WHERE company_id = $1 ORDER BY name ASC', [companyId]);
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota POST (criar cliente)
  router.post('/', protect, async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    const { name, po_number, vat_number, address, remark } = req.body;
    if (!name) { return res.status(400).json({ error: 'O nome do cliente é obrigatório.' }); }
    const queryText = `
      INSERT INTO clients (name, po_number, vat_number, address, remark, company_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const values = [name, po_number, vat_number, address, remark, companyId];
    try {
      const result = await pool.query(queryText, values);
      await createLog(pool, {
        userId,
        username,
        action: 'create',
        entity: 'client',
        entityId: result.rows[0].id,
        details: JSON.stringify(result.rows[0])
      });
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao criar cliente:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // --- NOVA ROTA PUT PARA ATUALIZAR UM CLIENTE ---
  router.put('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    const { name, po_number, vat_number, address, remark } = req.body;
    const queryText = `
      UPDATE clients 
      SET name = $1, po_number = $2, vat_number = $3, address = $4, remark = $5
      WHERE id = $6 AND company_id = $7
      RETURNING *;
    `;
    const values = [name, po_number, vat_number, address, remark, id, companyId];
    try {
      const result = await pool.query(queryText, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado ou não pertence à sua empresa.' });
      }
      await createLog(pool, {
        userId,
        username,
        action: 'update',
        entity: 'client',
        entityId: id,
        details: JSON.stringify(result.rows[0])
      });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao atualizar cliente:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // DELETE cliente
  router.delete('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    try {
      // Verifica se o cliente pertence à empresa
      const check = await pool.query('SELECT id FROM clients WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado ou não pertence à sua empresa.' });
      }
      await pool.query('DELETE FROM clients WHERE id = $1', [id]);
      await createLog(pool, {
        userId,
        username,
        action: 'delete',
        entity: 'client',
        entityId: id,
        details: null
      });
      res.json({ message: 'Cliente excluído com sucesso.' });
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  return router;
};