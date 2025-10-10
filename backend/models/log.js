// backend/models/log.js
module.exports = {
  createLog: async (pool, { userId, username, action, entity, entityId, details }) => {
    const query = `INSERT INTO logs (user_id, username, action, entity, entity_id, details, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, NOW())`;
    await pool.query(query, [userId, username, action, entity, entityId, details || null]);
  },
  getLogs: async (pool, { limit = 100 } = {}) => {
    const query = `SELECT * FROM logs ORDER BY created_at DESC LIMIT $1`;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }
};
