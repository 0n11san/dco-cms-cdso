const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query }  = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function toApiShape(row) {
  return {
    id:                  row.id,
    deliveryOrderName:   row.delivery_order_name,
    deliveryOrderNumber: row.delivery_order_number,
    vendorPOCs:          row.vendor_pocs,
    costs:               row.costs,
    por:                 row.por,
    popBeginDate:        row.pop_begin_date ? row.pop_begin_date.toISOString().split('T')[0] : '',
    popEndDate:          row.pop_end_date   ? row.pop_end_date.toISOString().split('T')[0]   : '',
    lineItems:           row.line_items,
    documents:           row.documents,
    notes:               row.notes,
    priorityOrder:       row.priority_order,
    vehicle:             row.vehicle,
    metricType:          row.metric_type,
  };
}

// GET /api/contracts
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM contracts ORDER BY priority_order ASC, created_at ASC');
    res.json(result.rows.map(toApiShape));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load contracts.' });
  }
});

// POST /api/contracts
router.post('/', requireAuth, async (req, res) => {
  const d = req.body;
  const id = uuidv4();
  try {
    const result = await query(
      `INSERT INTO contracts
        (id, delivery_order_name, delivery_order_number, vendor_pocs, costs, por,
         pop_begin_date, pop_end_date, line_items, documents, notes, vehicle, metric_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        id,
        d.deliveryOrderName,
        d.deliveryOrderNumber,
        JSON.stringify(d.vendorPOCs  || []),
        JSON.stringify(d.costs       || {}),
        d.por || [],
        d.popBeginDate || null,
        d.popEndDate   || null,
        JSON.stringify(d.lineItems   || []),
        JSON.stringify(d.documents   || { dd250: '', rip: '', other: [] }),
        d.notes   || '',
        d.vehicle || '',
        d.metricType || '',
      ]
    );

    await logAudit(req, 'CREATE', id, d.deliveryOrderName, {});
    res.status(201).json(toApiShape(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create contract.' });
  }
});

// PUT /api/contracts/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const d = req.body;
  try {
    const result = await query(
      `UPDATE contracts SET
        delivery_order_name   = $1,
        delivery_order_number = $2,
        vendor_pocs           = $3,
        costs                 = $4,
        por                   = $5,
        pop_begin_date        = $6,
        pop_end_date          = $7,
        line_items            = $8,
        documents             = $9,
        notes                 = $10,
        vehicle               = $11,
        metric_type           = $12,
        updated_at            = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        d.deliveryOrderName,
        d.deliveryOrderNumber,
        JSON.stringify(d.vendorPOCs || []),
        JSON.stringify(d.costs      || {}),
        d.por || [],
        d.popBeginDate || null,
        d.popEndDate   || null,
        JSON.stringify(d.lineItems  || []),
        JSON.stringify(d.documents  || { dd250: '', rip: '', other: [] }),
        d.notes   || '',
        d.vehicle || '',
        d.metricType || '',
        id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found.' });

    await logAudit(req, 'UPDATE', id, d.deliveryOrderName, {});
    res.json(toApiShape(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update contract.' });
  }
});

// DELETE /api/contracts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await query('SELECT delivery_order_name FROM contracts WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Contract not found.' });

    await query('DELETE FROM contracts WHERE id = $1', [id]);
    await logAudit(req, 'DELETE', id, existing.rows[0].delivery_order_name, {});
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete contract.' });
  }
});

// POST /api/contracts/:id/renewal
router.post('/:id/renewal', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const username = req.session.user.username;
  try {
    const result = await query(
      `INSERT INTO renewals (contract_id, notes, submitted_by) VALUES ($1, $2, $3) RETURNING *`,
      [id, notes || '', username]
    );
    const contract = await query('SELECT delivery_order_name FROM contracts WHERE id = $1', [id]);
    const name = contract.rows[0]?.delivery_order_name || '';
    await logAudit(req, 'RENEWAL', id, name, { notes });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit renewal.' });
  }
});

async function logAudit(req, action, contractId, contractName, details) {
  const user = req.session?.user || { username: 'unknown', role: 'unknown' };
  try {
    await query(
      `INSERT INTO audit_log (action, contract_id, contract_name, username, role, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, contractId, contractName, user.username, user.role, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = router;
