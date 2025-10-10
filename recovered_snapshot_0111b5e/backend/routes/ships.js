// backend/routes/ships.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  // Rota GET (sem alterações)
  router.get('/', protect, async (req, res) => {
    const companyId = req.user.companyId;
    try {
      const result = await pool.query('SELECT * FROM ships WHERE company_id = $1 ORDER BY id ASC', [companyId]);
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao buscar navios:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota POST (sem alterações)
  router.post('/', protect, async (req, res) => {
    const companyId = req.user.companyId;
    const { name, imo, dwt, grt, net, loa, beam, draft, depth, flag, year } = req.body;
    if (!name) { return res.status(400).json({ error: 'O nome do navio é obrigatório.' }); }
    const queryText = `
      INSERT INTO ships (name, imo, dwt, grt, net, loa, beam, draft, depth, flag, year, company_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`;
    const values = [name, imo, dwt, grt, net, loa, beam, draft, depth, flag, year, companyId];
    try {
      const result = await pool.query(queryText, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') { return res.status(409).json({ error: 'Este número IMO já está cadastrado para sua empresa.' });}
      console.error('Erro ao criar navio:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // --- NOVA ROTA PUT PARA ATUALIZAR UM NAVIO ---
  router.put('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    const { name, imo, dwt, grt, net, loa, beam, draft, depth, flag, year } = req.body;
    
    const queryText = `
      UPDATE ships 
      SET name = $1, imo = $2, dwt = $3, grt = $4, net = $5, loa = $6, beam = $7, draft = $8, depth = $9, flag = $10, year = $11
      WHERE id = $12 AND company_id = $13
      RETURNING *;
    `;
    const values = [name, imo, dwt, grt, net, loa, beam, draft, depth, flag, year, id, companyId];

    try {
      const result = await pool.query(queryText, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Navio não encontrado ou não pertence à sua empresa.' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') { return res.status(409).json({ error: 'Este número IMO já pertence a outro navio.' });}
      console.error('Erro ao atualizar navio:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};