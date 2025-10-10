// backend/routes/pilotage.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createLog } = require('../models/log');

module.exports = (pool) => {
  // --- ROTAS PARA A TABELA DE PRATICAGEM (TARIFF) ---

  // GET: Lista todas as tabelas de praticagem da empresa
  router.get('/tariffs', protect, async (req, res) => {
    const { companyId } = req.user;
    const query = `
      SELECT pt.*, p.name as port_name, p.terminal as port_terminal, p.berth as port_berth
      FROM pilotage_tariffs pt
      JOIN ports p ON pt.port_id = p.id
      WHERE pt.company_id = $1 ORDER BY p.name;
    `;
    try {
      const result = await pool.query(query, [companyId]);
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao buscar tabelas de praticagem:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  // POST: Cria ou atualiza uma tabela de praticagem (Upsert)
  router.post('/tariffs', protect, async (req, res) => {
    const { companyId } = req.user;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    const { id, name, tag_name, basis, pu_formula, port_id } = req.body;

    if (!name || !tag_name || !basis || !port_id) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
      let result;
      if (id) { // Se tem ID, é uma atualização
        const query = `
          UPDATE pilotage_tariffs 
          SET name = $1, tag_name = $2, basis = $3, pu_formula = $4, port_id = $5 
          WHERE id = $6 AND company_id = $7 RETURNING *`;
        result = await pool.query(query, [name, tag_name, basis, pu_formula, port_id, id, companyId]);
        await createLog(pool, {
          userId,
          username,
          action: 'update',
          entity: 'pilotage_tariff',
          entityId: id,
          details: JSON.stringify(result.rows[0])
        });
      } else { // Senão, é uma criação
        const query = `
          INSERT INTO pilotage_tariffs (name, tag_name, basis, pu_formula, port_id, company_id) 
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
        result = await pool.query(query, [name, tag_name, basis, pu_formula, port_id, companyId]);
        await createLog(pool, {
          userId,
          username,
          action: 'create',
          entity: 'pilotage_tariff',
          entityId: result.rows[0].id,
          details: JSON.stringify(result.rows[0])
        });
      }
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') { // Erro de unicidade
        return res.status(409).json({ error: 'Já existe uma tabela de praticagem para este porto ou esta TAG já está em uso.' });
      }
      console.error('Erro ao salvar tabela de praticagem:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // DELETE: Deleta uma tabela de praticagem
  router.delete('/tariffs/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    try {
      await pool.query('DELETE FROM pilotage_tariffs WHERE id = $1 AND company_id = $2', [id, companyId]);
      await createLog(pool, {
        userId,
        username,
        action: 'delete',
        entity: 'pilotage_tariff',
        entityId: id,
        details: null
      });
      res.status(204).send();
    } catch (err) {
      console.error('Erro ao deletar tabela:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // --- ROTAS PARA AS FAIXAS (RANGES) ---

  // GET: Busca todas as faixas de uma tabela específica
  router.get('/tariffs/:tariffId/ranges', protect, async (req, res) => {
    const { tariffId } = req.params;
    try {
      const result = await pool.query('SELECT * FROM pilotage_tariff_ranges WHERE tariff_id = $1 ORDER BY range_start ASC', [tariffId]);
      res.json(result.rows);
    } catch (err) {
      console.error('Erro ao buscar faixas:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // POST: Salva TODAS as faixas de uma tabela (deleta as antigas e insere as novas)
  router.post('/tariffs/:tariffId/ranges', protect, async (req, res) => {
    const { tariffId } = req.params;
    const { ranges } = req.body; // Recebe um array de faixas
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM pilotage_tariff_ranges WHERE tariff_id = $1', [tariffId]);
      for (const range of ranges) {
        await client.query(
          'INSERT INTO pilotage_tariff_ranges (tariff_id, range_start, range_end, value) VALUES ($1, $2, $3, $4)',
          [tariffId, range.range_start, range.range_end, range.value]
        );
      }
      await client.query('COMMIT');
      await createLog(pool, {
        userId,
        username,
        action: 'update',
        entity: 'pilotage_tariff_ranges',
        entityId: tariffId,
        details: JSON.stringify(ranges)
      });
      res.status(200).json({ message: 'Faixas salvas com sucesso.' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao salvar faixas:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      client.release();
    }
  });

  return router;
};