const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/email-preview/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query('SELECT * FROM contracts WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found.' });

    const c = result.rows[0];
    const popEnd = c.pop_end_date ? c.pop_end_date.toISOString().split('T')[0] : 'N/A';
    const daysLeft = c.pop_end_date
      ? Math.ceil((new Date(c.pop_end_date) - new Date()) / 86400000)
      : null;

    const primaryPOC = (c.vendor_pocs && c.vendor_pocs[0]) || {};

    res.json({
      subject: `Renewal Notice: ${c.delivery_order_name} — ${c.delivery_order_number}`,
      to:      primaryPOC.email || '',
      body: [
        `Dear ${primaryPOC.name || 'Vendor Representative'},`,
        '',
        `This is a formal renewal notice for Delivery Order ${c.delivery_order_number} — ${c.delivery_order_name}.`,
        '',
        `Period of Performance End Date: ${popEnd}`,
        daysLeft !== null ? `Days Remaining: ${daysLeft}` : '',
        '',
        `Please coordinate with your ARCYBER Program Manager to initiate renewal actions.`,
        '',
        'V/R,',
        'DCO Contract Management Office',
        'ARCYBER',
      ].filter(l => l !== null).join('\n'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate email preview.' });
  }
});

module.exports = router;
