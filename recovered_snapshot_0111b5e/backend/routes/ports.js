// backend/routes/ports.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  // ROTA GET (com o JOIN que já tínhamos)
  router.get('/', protect, async (req, res) => {
    const companyId = req.user.companyId;
    const queryText = `
      SELECT
        p.id, p.name, p.terminal, p.berth, p.remark, p.client_id,
        c.name AS client_name
      FROM ports AS p
      LEFT JOIN clients AS c ON p.client_id = c.id
      WHERE p.company_id = $1
      ORDER BY p.name ASC;
    `;
    try {
      const result = await pool.query(queryText, [companyId]);
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao buscar portos:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ROTA POST (sem alterações)
  router.post('/', protect, async (req, res) => {
    const companyId = req.user.companyId;
    const { name, terminal, berth, client_id, remark } = req.body;
    if (!name || !terminal || !berth) {
      return res.status(400).json({ error: 'Nome, Terminal e Berço são obrigatórios.' });
    }
    const queryText = `
      INSERT INTO ports (name, terminal, berth, client_id, remark, company_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
    `;
    const values = [name, terminal, berth, client_id, remark, companyId];
    try {
      const result = await pool.query(queryText, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao criar porto:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // --- NOVA ROTA PUT PARA ATUALIZAR UM PORTO ---
  router.put('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    const { name, terminal, berth, client_id, remark } = req.body;

    const queryText = `
      UPDATE ports
      SET name = $1, terminal = $2, berth = $3, client_id = $4, remark = $5
      WHERE id = $6 AND company_id = $7
      RETURNING *;
    `;
    const values = [name, terminal, berth, client_id, remark, id, companyId];

    try {
      const result = await pool.query(queryText, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Porto não encontrado ou não pertence à sua empresa.' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao atualizar porto:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};