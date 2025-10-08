// backend/routes/clients.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

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

  // Rota POST (sem alterações)
  router.post('/', protect, async (req, res) => {
    const companyId = req.user.companyId;
    const { name, po_number, vat_number, address, remark } = req.body;
    if (!name) { return res.status(400).json({ error: 'O nome do cliente é obrigatório.' }); }
    const queryText = `
      INSERT INTO clients (name, po_number, vat_number, address, remark, company_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const values = [name, po_number, vat_number, address, remark, companyId];
    try {
      const result = await pool.query(queryText, values);
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
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao atualizar cliente:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};