const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/priorities — returns contracts as ranked objects for the priorities UI
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, delivery_order_name AS name, delivery_order_number AS "doNumber",
              priority_order AS rank
       FROM contracts
       ORDER BY priority_order ASC, created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load priorities.' });
  }
});

// PUT /api/priorities — accepts { orderedIds: [uuid, ...] }
router.put('/', requireAuth, async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds must be an array.' });
  }

  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await query(
        'UPDATE contracts SET priority_order = $1, updated_at = NOW() WHERE id = $2',
        [i + 1, orderedIds[i]]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save priorities.' });
  }
});

module.exports = router;
