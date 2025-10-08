// backend/routes/ships.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createLog } = require('../models/log');

module.exports = (pool) => {
  // Helpers to sanitize inputs coming from forms (often as empty strings)
  const toIntOrNull = (v) => {
    if (v === undefined || v === null) return null;
    let s = String(v).trim();
    if (s === '') return null;
    // remove thousands separators and spaces
    s = s.replace(/[.,\s]/g, '');
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  };

  const toFloatOrNull = (v) => {
    if (v === undefined || v === null) return null;
    let s = String(v).trim();
    if (s === '') return null;
    // Normalize decimal separators: if both . and , exist -> comma is decimal, remove dots
    if (s.includes('.') && s.includes(',')) {
      s = s.replace(/\./g, '');
      s = s.replace(',', '.');
    } else if (s.includes(',')) {
      // Only comma present: use as decimal
      s = s.replace(',', '.');
    }
    // Remove spaces
    s = s.replace(/\s/g, '');
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  };

  const trimOrNull = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };

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

  // Rota POST (criar navio)
  router.post('/', protect, async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    const { name, imo, dwt, grt, net, loa, beam, draft, depth, flag, year } = req.body;
    const nameTrimmed = String(name || '').trim();
    if (!nameTrimmed) { return res.status(400).json({ error: 'O nome do navio é obrigatório.' }); }
    const queryText = `
      INSERT INTO ships (name, imo, dwt, grt, net, loa, beam, draft, depth, flag, year, company_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`;
    const values = [
      nameTrimmed,
      trimOrNull(imo),
      toIntOrNull(dwt),
      toIntOrNull(grt),
      toIntOrNull(net),
      toFloatOrNull(loa),
      toFloatOrNull(beam),
      toFloatOrNull(draft),
      toFloatOrNull(depth),
      trimOrNull(flag),
      toIntOrNull(year),
      companyId
    ];
    try {
      const result = await pool.query(queryText, values);
      await createLog(pool, {
        userId,
        username,
        action: 'create',
        entity: 'ship',
        entityId: result.rows[0].id,
        details: JSON.stringify(result.rows[0])
      });
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
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    const { name, imo, dwt, grt, net, loa, beam, draft, depth, flag, year } = req.body;
    const queryText = `
      UPDATE ships 
      SET name = $1, imo = $2, dwt = $3, grt = $4, net = $5, loa = $6, beam = $7, draft = $8, depth = $9, flag = $10, year = $11
      WHERE id = $12 AND company_id = $13
      RETURNING *;
    `;
    const nameTrimmed = String(name || '').trim();
    if (!nameTrimmed) { return res.status(400).json({ error: 'O nome do navio é obrigatório.' }); }
    const values = [
      nameTrimmed,
      trimOrNull(imo),
      toIntOrNull(dwt),
      toIntOrNull(grt),
      toIntOrNull(net),
      toFloatOrNull(loa),
      toFloatOrNull(beam),
      toFloatOrNull(draft),
      toFloatOrNull(depth),
      trimOrNull(flag),
      toIntOrNull(year),
      id,
      companyId
    ];

    try {
      const result = await pool.query(queryText, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Navio não encontrado ou não pertence à sua empresa.' });
      }
      await createLog(pool, {
        userId,
        username,
        action: 'update',
        entity: 'ship',
        entityId: id,
        details: JSON.stringify(result.rows[0])
      });
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') { return res.status(409).json({ error: 'Este número IMO já pertence a outro navio.' });}
      console.error('Erro ao atualizar navio:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // DELETE navio
  router.delete('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const username = req.user.name || req.user.email || '';
    try {
      // Verifica se o navio pertence à empresa
      const check = await pool.query('SELECT id FROM ships WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Navio não encontrado ou não pertence à sua empresa.' });
      }
      await pool.query('DELETE FROM ships WHERE id = $1', [id]);
      await createLog(pool, {
        userId,
        username,
        action: 'delete',
        entity: 'ship',
        entityId: id,
        details: null
      });
      res.json({ message: 'Navio excluído com sucesso.' });
    } catch (err) {
      console.error('Erro ao excluir navio:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  return router;
};