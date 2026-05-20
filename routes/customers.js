const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const { verifyManager } = require('../middleware/auth');

// GET all customers with phones and addresses (Manager only)
router.get('/', verifyManager, async (req, res) => {
  try {
    const [customers] = await db.query(
      `SELECT cust_id, name, email, is_verified, created_at 
       FROM customer ORDER BY created_at DESC`
    );

    for (const c of customers) {
      const [phones]    = await db.query(
        'SELECT c_phoneno FROM customer_phone WHERE cust_id = ?', [c.cust_id]
      );
      const [addresses] = await db.query(
        'SELECT c_address FROM customer_address WHERE cust_id = ?', [c.cust_id]
      );
      c.phones    = phones.map(p => p.c_phoneno).join(', ') || '—';
      c.addresses = addresses.map(a => a.c_address).join(', ') || '—';
    }

    res.json({ success: true, data: customers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE customer (Manager only)
router.delete('/:id', verifyManager, async (req, res) => {
  try {
    await db.query('DELETE FROM customer WHERE cust_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Customer deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;