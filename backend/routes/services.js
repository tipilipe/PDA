// backend/routes/services.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  router.get('/', protect, async (req, res) => {
    const { companyId } = req.user;
    try {
      const result = await pool.query('SELECT * FROM services WHERE company_id = $1 ORDER BY name ASC', [companyId]);
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao buscar serviços:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  router.post('/', protect, async (req, res) => {
    const { companyId } = req.user;
    const { name, is_taxable } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'O nome do serviço é obrigatório.' });
    }
    try {
      const queryText = 'INSERT INTO services (name, company_id, is_taxable) VALUES ($1, $2, $3) RETURNING *';
      const result = await pool.query(queryText, [name, companyId, is_taxable || false]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Este nome de serviço já está cadastrado.' });
      }
      console.error('Erro ao criar serviço:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  router.put('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    const { name, is_taxable } = req.body;
    
    const queryText = `
      UPDATE services 
      SET name = $1, is_taxable = $2
      WHERE id = $3 AND company_id = $4
      RETURNING *;
    `;
    const values = [name, is_taxable || false, id, companyId];

    try {
      const result = await pool.query(queryText, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Serviço não encontrado ou não pertence à sua empresa.' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Este nome de serviço já pertence a outro registro.' });
      }
      console.error('Erro ao atualizar serviço:', err);

      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota para deletar um serviço
  router.delete('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    try {
      const result = await pool.query(
        'DELETE FROM services WHERE id = $1 AND company_id = $2 RETURNING *',
        [id, companyId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Serviço não encontrado ou não pertence à sua empresa.' });
      }
      res.json({ success: true, deleted: result.rows[0] });
    } catch (err) {
      console.error('Erro ao deletar serviço:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};