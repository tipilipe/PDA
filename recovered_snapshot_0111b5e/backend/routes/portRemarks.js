// backend/routes/portRemarks.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  // ROTA GET: Busca todas as remarks de um porto específico
  router.get('/:portId', protect, async (req, res) => {
    const { portId } = req.params;
    const { companyId } = req.user;
    try {
      const result = await pool.query(
        'SELECT * FROM port_remarks WHERE port_id = $1 AND company_id = $2 ORDER BY display_order ASC',
        [portId, companyId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao buscar remarks do porto:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ROTA POST: Salva TODAS as remarks de um porto (deleta as antigas e insere as novas)
  router.post('/:portId', protect, async (req, res) => {
    const { portId } = req.params;
    const { remarks } = req.body; // Recebe um array de objetos remark [{remark_text, display_order}]
    const { companyId } = req.user;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 1. Deleta todas as remarks antigas para este porto
      await client.query('DELETE FROM port_remarks WHERE port_id = $1 AND company_id = $2', [portId, companyId]);

      // 2. Insere as novas remarks
      for (const remark of remarks) {
        await client.query(
          'INSERT INTO port_remarks (port_id, company_id, remark_text, display_order) VALUES ($1, $2, $3, $4)',
          [portId, companyId, remark.remark_text, remark.display_order]
        );
      }
      await client.query('COMMIT');
      res.status(200).json({ message: 'Remarks salvas com sucesso!' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao salvar remarks:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      client.release();
    }
  });

  return router;
};