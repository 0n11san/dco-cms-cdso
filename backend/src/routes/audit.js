const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit-log
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500'
    );
    res.json(result.rows.map(r => ({
      id:           r.id,
      action:       r.action,
      contractId:   r.contract_id,
      contractName: r.contract_name,
      username:     r.username,
      role:         r.role,
      details:      r.details,
      timestamp:    r.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load audit log.' });
  }
});

module.exports = router;
