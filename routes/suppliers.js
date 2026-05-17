const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const { verifyManager } = require('../middleware/auth');

// ── GET ALL SUPPLIERS ───────────────────────────────────────
router.get('/', verifyManager, async (req, res) => {
  try {
    const [suppliers] = await db.query(
      `SELECT s.supplier_id, s.name,
              GROUP_CONCAT(DISTINCT sp.phone      SEPARATOR ', ') AS phones,
              GROUP_CONCAT(DISTINCT si.ingredient SEPARATOR ', ') AS ingredients
       FROM supplier s
       LEFT JOIN supplier_phone       sp ON s.supplier_id = sp.supplier_id
       LEFT JOIN supplier_ingredients si ON s.supplier_id = si.supplier_id
       GROUP BY s.supplier_id
       ORDER BY s.name`
    );
    res.json({ success: true, data: suppliers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── ADD SUPPLIER ────────────────────────────────────────────
router.post('/', verifyManager, async (req, res) => {
  const { name, phones, ingredients } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Supplier name is required.' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO supplier (name) VALUES (?)', [name]
    );
    const supplier_id = result.insertId;

    if (phones && phones.length > 0) {
      for (const phone of phones) {
        await db.query(
          'INSERT INTO supplier_phone VALUES (?, ?)', [supplier_id, phone]
        );
      }
    }
    if (ingredients && ingredients.length > 0) {
      for (const ingredient of ingredients) {
        await db.query(
          'INSERT INTO supplier_ingredients VALUES (?, ?)', [supplier_id, ingredient]
        );
      }
    }

    res.status(201).json({ success: true, message: 'Supplier added.', supplier_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE SUPPLIER ─────────────────────────────────────────
router.delete('/:id', verifyManager, async (req, res) => {
  try {
    await db.query('DELETE FROM supplier WHERE supplier_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Supplier deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;