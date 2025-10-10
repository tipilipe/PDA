// backend/routes/logs.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  const { getLogs } = require('../models/log');

  // GET /api/logs - lista os logs
  router.get('/', protect, async (req, res) => {
    try {
      const logs = await getLogs(pool, { limit: 200 });
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar logs.' });
    }
  });

  return router;
};
