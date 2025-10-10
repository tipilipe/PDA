// backend/routes/services.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createLog } = require('../models/log');

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
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    const { name, is_taxable } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'O nome do serviço é obrigatório.' });
    }
    try {
      const queryText = 'INSERT INTO services (name, company_id, is_taxable) VALUES ($1, $2, $3) RETURNING *';
      const result = await pool.query(queryText, [name, companyId, is_taxable || false]);
      await createLog(pool, {
        userId,
        username,
        action: 'create',
        entity: 'service',
        entityId: result.rows[0].id,
        details: JSON.stringify(result.rows[0])
      });
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
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
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
      await createLog(pool, {
        userId,
        username,
        action: 'update',
        entity: 'service',
        entityId: id,
        details: JSON.stringify(result.rows[0])
      });
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Este nome de serviço já pertence a outro registro.' });
      }
      console.error('Erro ao atualizar serviço:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // DELETE serviço
  router.delete('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    try {
      // Verifica se o serviço pertence à empresa
      const check = await pool.query('SELECT id FROM services WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Serviço não encontrado ou não pertence à sua empresa.' });
      }
      await pool.query('DELETE FROM services WHERE id = $1', [id]);
      await createLog(pool, {
        userId,
        username,
        action: 'delete',
        entity: 'service',
        entityId: id,
        details: null
      });
      res.json({ message: 'Serviço excluído com sucesso.' });
    } catch (err) {
      console.error('Erro ao excluir serviço:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  return router;
};