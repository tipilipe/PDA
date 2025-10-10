// backend/routes/engine.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { create, all } = require('mathjs');

const math = create(all);

/**
 * Converte strings/valores potenciais para número de forma segura.
 * Aceita "1.234,56", "1234,56", "1234.56", numbers, null, undefined.
 */
const parseNumberSafe = (raw) => {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let s = String(raw).trim();
  if (s === '') return 0;
  const hasDot = s.indexOf('.') !== -1;
  const hasComma = s.indexOf(',') !== -1;
  if (hasDot && hasComma) {
    s = s.replace(/\./g, '').replace(',', '.'); // "1.234,56" => "1234.56"
  } else if (!hasDot && hasComma) {
    s = s.replace(',', '.'); // "1234,56" => "1234.56"
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Validação básica da fórmula para evitar execução de coisas estranhas.
 */
const isFormulaSafe = (formula) => {
  if (!formula || typeof formula !== 'string') return false;
  const forbidden = /;|\bprocess\b|\brequire\b|\bfs\b|\bchild_process\b|\beval\b|\bconsole\b/iu;
  return !forbidden.test(formula);
};

module.exports = (pool) => {
  // GET todas as PDAs
  router.get('/', protect, async (req, res) => {
    const { companyId } = req.user;
    const queryText = `
      SELECT 
        pda.id, 
        pda.pda_number,
        pda.created_at,
        c.name as client_name,
        s.name as ship_name,
        p.name as port_name,
        p.terminal as port_terminal
      FROM pdas pda
      JOIN clients c ON pda.client_id = c.id
      JOIN ships s ON pda.ship_id = s.id
      JOIN ports p ON pda.port_id = p.id
      WHERE pda.company_id = $1
      ORDER BY pda.created_at DESC;
    `;
    try {
      const result = await pool.query(queryText, [companyId]);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar PDAs:", err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // GET detalhes de uma PDA
  router.get('/:id', protect, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    try {
      const pdaQuery = `
        SELECT pda.*, 
               s.id as ship_id, s.name as ship_name, s.dwt, s.grt, s.net, s.loa, s.beam, s.draft, s.depth, s.flag, s.year,
               c.id as client_id, c.name as client_name, c.po_number, c.vat_number, c.address,
               pt.id as port_id, pt.name as port_name, pt.terminal, pt.berth
        FROM pdas pda
        JOIN ships s ON pda.ship_id = s.id
        JOIN clients c ON pda.client_id = c.id
        JOIN ports pt ON pda.port_id = pt.id
        WHERE pda.id = $1 AND pda.company_id = $2
      `;
      const pdaRes = await pool.query(pdaQuery, [id, companyId]);
      if (pdaRes.rows.length === 0) return res.status(404).json({ error: 'PDA não encontrada.' });
      
      const pdaData = pdaRes.rows[0];
      const itemsRes = await pool.query('SELECT * FROM pda_items WHERE pda_id = $1 ORDER BY id ASC', [id]);
      const remarksRes = await pool.query('SELECT * FROM port_remarks WHERE port_id = $1 AND company_id = $2 ORDER BY display_order ASC', [pdaData.port_id, companyId]);

      const responsePayload = {
        ship: { id: pdaData.ship_id, name: pdaData.ship_name, dwt: pdaData.dwt, grt: pdaData.grt, net: pdaData.net, loa: pdaData.loa, beam: pdaData.beam, draft: pdaData.draft, depth: pdaData.depth, flag: pdaData.flag, year: pdaData.year },
        port: { id: pdaData.port_id, name: pdaData.port_name, terminal: pdaData.terminal, berth: pdaData.berth },
        client: { id: pdaData.client_id, name: pdaData.client_name, po_number: pdaData.po_number, vat_number: pdaData.vat_number, address: pdaData.address },
        roe: pdaData.roe,
        items: itemsRes.rows,
        remarks: remarksRes.rows,
        pda_number: pdaData.pda_number,
        cargo: pdaData.cargo_description,
        totalCargo: pdaData.total_cargo,
        eta: pdaData.eta,
        etb: pdaData.etb,
        etd: pdaData.etd
      };
      res.json(responsePayload);
    } catch (err) {
      console.error('Erro ao buscar PDA:', err);
      res.status(500).json({ error: 'Erro interno do servidor'} );
    }
  });

  // POST calcular
  router.post('/calculate', protect, async (req, res) => {
    const { ship_id, port_id, client_id, roe, totalCargo, cargo, pdaNumber, eta, etb, etd } = req.body;
    const { companyId } = req.user;
    if (!ship_id || !port_id || !roe || !client_id) {
      return res.status(400).json({ error: 'Navio, Porto, Cliente e ROE são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
      const [shipRes, portRes, clientRes, linkedServicesRes, calculationsRes, remarksRes] = await Promise.all([
        client.query('SELECT * FROM ships WHERE id = $1 AND company_id = $2', [ship_id, companyId]),
        client.query('SELECT * FROM ports WHERE id = $1 AND company_id = $2', [port_id, companyId]),
        client.query('SELECT * FROM clients WHERE id = $1 AND company_id = $2', [client_id, companyId]),
        client.query('SELECT service_id FROM port_services WHERE port_id = $1 AND company_id = $2', [port_id, companyId]),
        client.query(`SELECT calc.*, s.name as service_name FROM calculations calc JOIN services s ON s.id = calc.service_id WHERE calc.port_id = $1 AND calc.company_id = $2`, [port_id, companyId]),
        client.query('SELECT * FROM port_remarks WHERE port_id = $1 AND company_id = $2 ORDER BY display_order ASC', [port_id, companyId]),
        // --- ADICIONE ESTA LINHA ---
        client.query('SELECT * FROM pilotage_tariffs WHERE port_id = $1 AND company_id = $2', [port_id, companyId])
      ]);

      if (!shipRes.rows.length) return res.status(404).json({ error: 'Navio não encontrado.' });
      if (!portRes.rows.length) return res.status(404).json({ error: 'Porto não encontrado.' });
      if (!clientRes.rows.length) return res.status(404).json({ error: 'Cliente não encontrado.' });

      const ship = shipRes.rows[0];
      const port = portRes.rows[0];
      const selectedClient = clientRes.rows[0];
      const linkedServiceIds = new Set(linkedServicesRes.rows.map(r => r.service_id));
      const calculations = calculationsRes.rows;
      const remarks = remarksRes.rows;

      const scope = {
        '@DWT': parseNumberSafe(ship.dwt || 0),
        '@GRT': parseNumberSafe(ship.grt || 0),
        '@NET': parseNumberSafe(ship.net || 0),
        '@LOA': parseNumberSafe(ship.loa || 0),
        '@BEAM': parseNumberSafe(ship.beam || 0),
        '@DRAFT': parseNumberSafe(ship.draft || ship.depth || 0),
        '@DEPTH': parseNumberSafe(ship.depth || 0),
        '@YEAR': Number.isFinite(Number(ship.year)) ? Number(ship.year) : 0,
        '@TOTAL_CARGO': parseNumberSafe(totalCargo || 0),
        '@ROE': parseNumberSafe(roe || 0)
      };

      const calculatedItems = [];

      for (const calc of calculations) {
        if (!linkedServiceIds.has(calc.service_id)) continue;
        let resultValue = 0;
        const method = (calc.calculation_method || '').toUpperCase();

        if (method === 'FIXED') {
          resultValue = parseNumberSafe(calc.formula);
        } else if (method === 'FORMULA') {
          if (!isFormulaSafe(calc.formula)) {
            console.error(`Fórmula bloqueada: ${calc.formula}`);
            resultValue = 0;
          } else {
            const safeScope = {};
            Object.keys(scope).forEach(k => { safeScope[k] = Number(scope[k]) || 0; });

            try {
              const evalResult = math.evaluate(calc.formula, safeScope);
              resultValue = parseNumberSafe(evalResult);
            } catch (e) {
              console.error(`Erro fórmula: ${calc.formula}`, e);
              resultValue = 0;
            }
          }
        } else if (method === 'CONDITIONAL') {
          try {
            const c = JSON.parse(calc.formula);
            let ruleMatched = false;
            for (const rule of c.rules) {
              const varName = rule.variable;
              const left = Number.isFinite(Number(scope[varName])) ? Number(scope[varName]) : 0;
              const operator = rule.operator;
              const right = parseNumberSafe(rule.value);
              let exprResult = false;
              switch (operator) {
                case '>': exprResult = left > right; break;
                case '<': exprResult = left < right; break;
                case '>=': exprResult = left >= right; break;
                case '<=': exprResult = left <= right; break;
                case '==': exprResult = left == right; break;
                case '===': exprResult = left === right; break;
                case '!=': exprResult = left != right; break;
                case '!==': exprResult = left !== right; break;
                default:
                  try { exprResult = Boolean(math.evaluate(`${left} ${operator} ${right}`)); }
                  catch { exprResult = false; }
              }
              if (exprResult) { resultValue = parseNumberSafe(rule.result); ruleMatched = true; break; }
            }
            if (!ruleMatched) resultValue = parseNumberSafe(c.defaultValue);
          } catch (e) {
            console.error(`Erro condicional: ${calc.formula}`, e);
            resultValue = 0;
          }
        }

        resultValue = parseNumberSafe(resultValue);
        calculatedItems.push({ service_name: calc.service_name, value: resultValue, currency: calc.currency });
      }

      const responsePayload = { ship, port, client: selectedClient, roe, items: calculatedItems, remarks, pdaNumber, cargo, totalCargo, eta, etb, etd };
      res.json(responsePayload);
    } catch (err) {
      console.error('Erro ao calcular PDA:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      client.release();
    }
  });

  // POST salvar PDA
  router.post('/save', protect, async (req, res) => {
    const { pdaData } = req.body;
    const { companyId } = req.user;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const pdaInsertQuery = `
        INSERT INTO pdas (pda_number, ship_id, client_id, port_id, roe, company_id, cargo_description, total_cargo, eta, etb, etd)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id;
      `;
      const pdaInsertValues = [ 
        pdaData.pdaNumber, 
        pdaData.ship.id, 
        pdaData.client.id, 
        pdaData.port.id, 
        pdaData.roe, 
        companyId, 
        pdaData.cargo, 
        pdaData.totalCargo, 
        pdaData.eta || null, 
        pdaData.etb || null, 
        pdaData.etd || null 
      ];
      const pdaInsertRes = await pool.query(pdaInsertQuery, pdaInsertValues);
      const newPdaId = pdaInsertRes.rows[0].id;
      for (const item of pdaData.items) {
        const itemInsertQuery = `INSERT INTO pda_items (pda_id, service_name, value, currency) VALUES ($1, $2, $3, $4);`;
        const valueToInsert = parseNumberSafe(item.value);
        await client.query(itemInsertQuery, [newPdaId, item.service_name, valueToInsert, item.currency]);
      }
      await client.query('COMMIT');
      res.status(201).json({ message: 'PDA salva com sucesso!', pdaId: newPdaId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao salvar PDA:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      client.release();
    }
  });

  return router;
};
