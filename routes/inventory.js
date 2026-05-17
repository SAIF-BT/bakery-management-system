const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const { verifyManager } = require('../middleware/auth');

// ── GET ALL INVENTORY ───────────────────────────────────────
router.get('/', verifyManager, async (req, res) => {
  try {
    const [inventory] = await db.query(
      `SELECT i.inventory_id, i.stock,
              GROUP_CONCAT(ii.ingredient SEPARATOR ', ') AS ingredients
       FROM inventory i
       LEFT JOIN inventory_ingredients ii ON i.inventory_id = ii.inventory_id
       GROUP BY i.inventory_id
       ORDER BY i.inventory_id`
    );
    res.json({ success: true, data: inventory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET LOW STOCK ALERTS ────────────────────────────────────
router.get('/low-stock', verifyManager, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM view_low_stock');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── UPDATE STOCK ────────────────────────────────────────────
router.patch('/:id/stock', verifyManager, async (req, res) => {
  const { stock, staff_id } = req.body;
  try {
    await db.query(
      'UPDATE inventory SET stock = ? WHERE inventory_id = ?',
      [stock, req.params.id]
    );
    if (staff_id) {
      await db.query(
        `INSERT INTO manages (staff_id, inventory_id, modifying_date)
         VALUES (?, ?, CURDATE())
         ON DUPLICATE KEY UPDATE modifying_date = CURDATE()`,
        [staff_id, req.params.id]
      );
    }
    res.json({ success: true, message: 'Stock updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;