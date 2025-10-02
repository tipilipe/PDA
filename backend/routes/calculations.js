// backend/routes/calculations.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  router.get('/:portId', protect, async (req, res) => {
    const { portId } = req.params;
    const { companyId } = req.user;
    try {
      const result = await pool.query(
        `SELECT calc.*, s.name as service_name 
         FROM calculations AS calc
         JOIN services AS s ON calc.service_id = s.id
         WHERE calc.port_id = $1 AND calc.company_id = $2 ORDER BY s.name`,
        [portId, companyId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao buscar cálculos:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  router.post('/', protect, async (req, res) => {
    const { port_id, service_id, currency, formula, calculation_method } = req.body;
    const { companyId } = req.user;
    if (!port_id || !service_id || !currency || !formula || !calculation_method) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }
    const queryText = `
      INSERT INTO calculations (port_id, service_id, currency, formula, company_id, calculation_method)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (port_id, service_id, currency, company_id)
      DO UPDATE SET formula = EXCLUDED.formula, calculation_method = EXCLUDED.calculation_method
      RETURNING *;
    `;
    const values = [port_id, service_id, currency, formula, companyId, calculation_method];
    try {
      const result = await pool.query(queryText, values);
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao salvar cálculo:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Atualiza um cálculo existente por ID (permite alterar moeda, método e fórmula)
  router.put('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { port_id, service_id, currency, formula, calculation_method } = req.body;
    const { companyId } = req.user;
    if (!port_id || !service_id || !currency || !formula || !calculation_method) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }
    try {
      const result = await pool.query(
        `UPDATE calculations
         SET port_id = $1, service_id = $2, currency = $3, formula = $4, calculation_method = $5
         WHERE id = $6 AND company_id = $7
         RETURNING *`,
        [port_id, service_id, currency, formula, calculation_method, id, companyId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Cálculo não encontrado ou não pertence à sua empresa.' });
      }
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Erro ao atualizar cálculo:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // --- NOVA ROTA DELETE PARA EXCLUIR UM CÁLCULO ---
  router.delete('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    try {
      const result = await pool.query(
        'DELETE FROM calculations WHERE id = $1 AND company_id = $2 RETURNING *',
        [id, companyId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Cálculo não encontrado ou não pertence à sua empresa.' });
      }
      res.status(204).send(); // Sucesso, sem corpo de resposta
    } catch (err) {
      console.error('Erro ao deletar cálculo:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};