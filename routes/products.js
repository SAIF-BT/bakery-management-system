const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const { verifyManager } = require('../middleware/auth');

// ── GET ALL PRODUCTS ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [products] = await db.query(
      `SELECT p.prod_id, p.p_name, p.price, p.category_type, 
              p.is_available, p.image_url,
              c.c_flavour, pa.p_flavour, b.bread_type,
              bi.kind, bkf.b_flavour
       FROM product p
       LEFT JOIN cake              c   ON p.prod_id = c.prod_id
       LEFT JOIN pastry            pa  ON p.prod_id = pa.prod_id
       LEFT JOIN bread             b   ON p.prod_id = b.prod_id
       LEFT JOIN biscuit           bi  ON p.prod_id = bi.prod_id
       LEFT JOIN biscuit_kind_flavour bkf ON bi.kind = bkf.kind
       ORDER BY p.category_type, p.p_name`
    );
    res.json({ success: true, data: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET PRODUCTS BY CATEGORY ────────────────────────────────
router.get('/category/:cat', async (req, res) => {
  try {
    const [products] = await db.query(
      `SELECT p.prod_id, p.p_name, p.price, p.category_type,
              p.is_available, p.image_url
       FROM product p
       WHERE p.category_type = ? AND p.is_available = 1`,
      [req.params.cat]
    );
    res.json({ success: true, data: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET SINGLE PRODUCT ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.c_flavour, pa.p_flavour,
              b.bread_type, bi.kind, bkf.b_flavour
       FROM product p
       LEFT JOIN cake              c   ON p.prod_id = c.prod_id
       LEFT JOIN pastry            pa  ON p.prod_id = pa.prod_id
       LEFT JOIN bread             b   ON p.prod_id = b.prod_id
       LEFT JOIN biscuit           bi  ON p.prod_id = bi.prod_id
       LEFT JOIN biscuit_kind_flavour bkf ON bi.kind = bkf.kind
       WHERE p.prod_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── ADD PRODUCT (Manager only) ──────────────────────────────
router.post('/', verifyManager, async (req, res) => {
  const { p_name, price, category_type, image_url,
          c_flavour, p_flavour, bread_type, kind } = req.body;

  if (!p_name || !price || !category_type) {
    return res.status(400).json({ success: false, message: 'Name, price and category are required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO product (p_name, price, category_type, image_url)
       VALUES (?, ?, ?, ?)`,
      [p_name, price, category_type, image_url || null]
    );
    const prod_id = result.insertId;

    // Insert into specialization table
    if (category_type === 'Cake' && c_flavour) {
      await db.query('INSERT INTO cake VALUES (?, ?)', [prod_id, c_flavour]);
    } else if (category_type === 'Pastry' && p_flavour) {
      await db.query('INSERT INTO pastry VALUES (?, ?)', [prod_id, p_flavour]);
    } else if (category_type === 'Bread' && bread_type) {
      await db.query('INSERT INTO bread VALUES (?, ?)', [prod_id, bread_type]);
    } else if (category_type === 'Biscuit' && kind) {
      await db.query('INSERT INTO biscuit VALUES (?, ?)', [prod_id, kind]);
    }

    res.status(201).json({
      success: true,
      message: 'Product added successfully.',
      prod_id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── UPDATE PRODUCT (Manager only) ──────────────────────────
router.put('/:id', verifyManager, async (req, res) => {
  const { p_name, price, is_available, image_url } = req.body;
  try {
    await db.query(
      `UPDATE product 
       SET p_name = ?, price = ?, is_available = ?, image_url = ?
       WHERE prod_id = ?`,
      [p_name, price, is_available, image_url, req.params.id]
    );
    res.json({ success: true, message: 'Product updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE PRODUCT (Manager only) ──────────────────────────
router.delete('/:id', verifyManager, async (req, res) => {
  try {
    await db.query('DELETE FROM product WHERE prod_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;