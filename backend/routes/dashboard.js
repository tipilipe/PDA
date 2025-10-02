const express = require('express');
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  const router = express.Router();

  router.get('/', protect, async (req, res) => {
    const { companyId } = req.user;
    // Permite ajustar a janela via query param (?months=12) ou por intervalo (?start=YYYY-MM-DD&end=YYYY-MM-DD)
    const months = Math.max(1, Math.min(36, parseInt(req.query.months || '12', 10) || 12));
    const start = (req.query.start || '').trim();
    const end = (req.query.end || '').trim();
    try {
      const client = await pool.connect();
      try {
        // Contagens básicas
        const [ships, clients, ports, services, pdas] = await Promise.all([
          client.query('SELECT COUNT(*) AS c FROM ships WHERE company_id = $1', [companyId]),
          client.query('SELECT COUNT(*) AS c FROM clients WHERE company_id = $1', [companyId]),
          client.query('SELECT COUNT(*) AS c FROM ports WHERE company_id = $1', [companyId]),
          client.query('SELECT COUNT(*) AS c FROM services WHERE company_id = $1', [companyId]),
          client.query('SELECT COUNT(*) AS c FROM pdas WHERE company_id = $1', [companyId]),
        ]);

        // Decide se usa intervalo customizado ou janela de N meses
        let monthly;
        let periodFilter = '';
        let paramsBase = [companyId];
        if (start && end) {
          // Intervalo customizado
          monthly = await client.query(
            `WITH bounds AS (
               SELECT date_trunc('month', $2::date) AS start_m,
                      date_trunc('month', $3::date) AS end_m
             ), months AS (
               SELECT generate_series(start_m, end_m, interval '1 month') AS m FROM bounds
             )
             SELECT to_char(m.m, 'YYYY-MM') AS month,
                    COALESCE(SUM(CASE WHEN pi.currency = 'USD' THEN pi.value ELSE 0 END), 0) AS usd_total,
                    COALESCE(SUM(CASE WHEN pi.currency = 'BRL' THEN pi.value ELSE 0 END), 0) AS brl_total,
                    COALESCE(SUM(CASE WHEN pi.currency = 'USD' THEN pi.value * pda.roe WHEN pi.currency = 'BRL' THEN pi.value ELSE 0 END), 0) AS brl_converted_total
             FROM months m
             LEFT JOIN pdas pda ON pda.company_id = $1 AND date_trunc('month', pda.created_at) = m.m AND pda.created_at >= $2::date AND pda.created_at < ($3::date + interval '1 day')
             LEFT JOIN pda_items pi ON pi.pda_id = pda.id
             GROUP BY m.m
             ORDER BY m.m ASC;`,
            [companyId, start, end]
          );
          periodFilter = ' AND pda.created_at >= $2::date AND pda.created_at < ($3::date + interval \'' + '1 day' + '\') ';
          paramsBase = [companyId, start, end];
        } else {
          // Últimos N meses (padrão)
          monthly = await client.query(
            `WITH months AS (
               SELECT date_trunc('month', (CURRENT_DATE - (g * interval '1 month'))) AS m
               FROM generate_series(0, $2) AS g
             )
             SELECT to_char(m.m, 'YYYY-MM') AS month,
                    COALESCE(SUM(CASE WHEN pi.currency = 'USD' THEN pi.value ELSE 0 END), 0) AS usd_total,
                    COALESCE(SUM(CASE WHEN pi.currency = 'BRL' THEN pi.value ELSE 0 END), 0) AS brl_total,
                    COALESCE(SUM(CASE WHEN pi.currency = 'USD' THEN pi.value * pda.roe WHEN pi.currency = 'BRL' THEN pi.value ELSE 0 END), 0) AS brl_converted_total
             FROM months m
             LEFT JOIN pdas pda ON pda.company_id = $1 AND date_trunc('month', pda.created_at) = m.m
             LEFT JOIN pda_items pi ON pi.pda_id = pda.id
             GROUP BY m.m
             ORDER BY m.m ASC;`,
            [companyId, months - 1]
          );
        }

        // Top clientes por BRL convertido (últimos 12 meses)
        const topClients = await client.query(
          `SELECT c.id, c.name,
                  COALESCE(SUM(CASE WHEN pi.currency = 'USD' THEN pi.value * pda.roe WHEN pi.currency = 'BRL' THEN pi.value ELSE 0 END), 0) AS total_brl
           FROM pdas pda
           JOIN clients c ON c.id = pda.client_id
           LEFT JOIN pda_items pi ON pi.pda_id = pda.id
           WHERE pda.company_id = $1${periodFilter || " AND pda.created_at >= (CURRENT_DATE - interval '12 months')"}
           GROUP BY c.id, c.name
           ORDER BY total_brl DESC
           LIMIT 5;`,
          paramsBase
        );

        // Top portos por BRL convertido (últimos 12 meses)
        const topPorts = await client.query(
          `SELECT pt.id, pt.name,
                  COALESCE(SUM(CASE WHEN pi.currency = 'USD' THEN pi.value * pda.roe WHEN pi.currency = 'BRL' THEN pi.value ELSE 0 END), 0) AS total_brl
           FROM pdas pda
           JOIN ports pt ON pt.id = pda.port_id
           LEFT JOIN pda_items pi ON pi.pda_id = pda.id
           WHERE pda.company_id = $1${periodFilter || " AND pda.created_at >= (CURRENT_DATE - interval '12 months')"}
           GROUP BY pt.id, pt.name
           ORDER BY total_brl DESC
           LIMIT 5;`,
          paramsBase
        );

        // Últimas PDAs
        const recentPdas = await client.query(
          `SELECT pda.id, pda.pda_number, pda.created_at,
                  c.name AS client_name, s.name AS ship_name, pt.name AS port_name
           FROM pdas pda
           JOIN clients c ON pda.client_id = c.id
           JOIN ships s ON pda.ship_id = s.id
           JOIN ports pt ON pda.port_id = pt.id
           WHERE pda.company_id = $1${periodFilter || ''}
           ORDER BY pda.created_at DESC
           LIMIT 10;`,
          paramsBase
        );

        // Totais agregados gerais por moeda (últimos 90 dias)
        const totals = await client.query(
          `SELECT 
              COALESCE(SUM(CASE WHEN pi.currency = 'USD' THEN pi.value ELSE 0 END), 0) AS usd_total,
              COALESCE(SUM(CASE WHEN pi.currency = 'BRL' THEN pi.value ELSE 0 END), 0) AS brl_total,
              COALESCE(SUM(CASE WHEN pi.currency = 'USD' THEN pi.value * pda.roe WHEN pi.currency = 'BRL' THEN pi.value ELSE 0 END), 0) AS brl_converted_total
           FROM pdas pda
           LEFT JOIN pda_items pi ON pi.pda_id = pda.id
           WHERE pda.company_id = $1${periodFilter || " AND pda.created_at >= (CURRENT_DATE - interval '90 days')"};`,
          paramsBase
        );

        res.json({
          summary: {
            ships: Number(ships.rows[0].c || 0),
            clients: Number(clients.rows[0].c || 0),
            ports: Number(ports.rows[0].c || 0),
            services: Number(services.rows[0].c || 0),
            pdas: Number(pdas.rows[0].c || 0),
            totals: totals.rows[0] || { usd_total: 0, brl_total: 0, brl_converted_total: 0 }
          },
          monthly: monthly.rows,
          topClients: topClients.rows,
          topPorts: topPorts.rows,
          recentPdas: recentPdas.rows,
        });
      } finally {
        client.release();
      }
    } catch (e) {
      console.error('Erro no dashboard:', e);
      res.status(500).json({ error: 'Erro ao montar dashboard.' });
    }
  });

  return router;
};
