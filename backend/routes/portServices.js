// backend/routes/portServices.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  // ROTA GET: Busca os IDs dos serviços vinculados a um porto específico
  router.get('/:portId', protect, async (req, res) => {
    const { portId } = req.params;
    const { companyId } = req.user;

    try {
      const result = await pool.query(
        'SELECT service_id FROM port_services WHERE port_id = $1 AND company_id = $2',
        [portId, companyId]
      );
      // Retorna apenas um array de IDs, ex: [1, 5, 12]
      res.json(result.rows.map(row => row.service_id));
    } catch (err) {
      console.error('Erro ao buscar serviços do porto:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ROTA POST: Atualiza a lista de serviços de um porto
  router.post('/:portId', protect, async (req, res) => {
    const { portId } = req.params;
    const { serviceIds } = req.body; // Recebe um array de IDs, ex: [1, 3, 7]
    const { companyId } = req.user;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Deleta todos os vínculos antigos para este porto e empresa
      await client.query('DELETE FROM port_services WHERE port_id = $1 AND company_id = $2', [portId, companyId]);

      // 2. Insere os novos vínculos um por um
      for (const serviceId of serviceIds) {
        await client.query(
          'INSERT INTO port_services (port_id, service_id, company_id) VALUES ($1, $2, $3)',
          [portId, serviceId, companyId]
        );
      }

      await client.query('COMMIT');
      res.status(200).json({ message: 'Vínculos atualizados com sucesso!' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao atualizar vínculos do porto:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      client.release();
    }
  });

  return router;
};