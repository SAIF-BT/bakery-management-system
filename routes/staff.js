const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const { verifyManager } = require('../middleware/auth');

// ── GET ALL STAFF ───────────────────────────────────────────
router.get('/', verifyManager, async (req, res) => {
  try {
    const [staff] = await db.query(
      `SELECT bs.staff_id, bs.name, bs.role, rs.salary,
              bk.health_certificate_no,
              ca.desk_tel,
              mg.email AS manager_email
       FROM bakery_staff bs
       JOIN role_salary rs ON bs.role = rs.role
       LEFT JOIN baker   bk ON bs.staff_id = bk.staff_id
       LEFT JOIN cashier ca ON bs.staff_id = ca.staff_id
       LEFT JOIN manager mg ON bs.staff_id = mg.staff_id
       ORDER BY bs.role, bs.name`
    );
    res.json({ success: true, data: staff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET SINGLE STAFF ────────────────────────────────────────
router.get('/:id', verifyManager, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT bs.*, rs.salary,
              bk.health_certificate_no,
              ca.desk_tel,
              mg.email AS manager_email
       FROM bakery_staff bs
       JOIN role_salary rs ON bs.role = rs.role
       LEFT JOIN baker   bk ON bs.staff_id = bk.staff_id
       LEFT JOIN cashier ca ON bs.staff_id = ca.staff_id
       LEFT JOIN manager mg ON bs.staff_id = mg.staff_id
       WHERE bs.staff_id = ?`, [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── ADD STAFF ───────────────────────────────────────────────
router.post('/', verifyManager, async (req, res) => {
  const { name, role, health_certificate_no, desk_tel, email, phoneno } = req.body;
  if (!name || !role) {
    return res.status(400).json({ success: false, message: 'Name and role are required.' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO bakery_staff (name, role) VALUES (?, ?)', [name, role]
    );
    const staff_id = result.insertId;
    if (role === 'Baker' && health_certificate_no) {
      await db.query('INSERT INTO baker VALUES (?, ?)', [staff_id, health_certificate_no]);
    } else if (role === 'Cashier' && desk_tel) {
      await db.query('INSERT INTO cashier VALUES (?, ?)', [staff_id, desk_tel]);
    } else if (role === 'Manager' && email) {
      await db.query('INSERT INTO manager (staff_id, email) VALUES (?, ?)', [staff_id, email]);
    }
    if (phoneno) {
      await db.query('INSERT INTO staff_phone VALUES (?, ?)', [staff_id, phoneno]);
    }
    res.status(201).json({ success: true, message: 'Staff added successfully.', staff_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── UPDATE STAFF ────────────────────────────────────────────
router.put('/:id', verifyManager, async (req, res) => {
  const { name } = req.body;
  try {
    await db.query(
      'UPDATE bakery_staff SET name = ? WHERE staff_id = ?', [name, req.params.id]
    );
    res.json({ success: true, message: 'Staff updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE STAFF ────────────────────────────────────────────
router.delete('/:id', verifyManager, async (req, res) => {
  try {
    await db.query('DELETE FROM bakery_staff WHERE staff_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Staff deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET ALL CUSTOMERS (Manager view) ───────────────────────
router.get('/admin/customers', verifyManager, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT cust_id, name, email, is_verified, created_at FROM customer ORDER BY created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE CUSTOMER (Manager only) ─────────────────────────
router.delete('/admin/customers/:id', verifyManager, async (req, res) => {
  try {
    await db.query('DELETE FROM customer WHERE cust_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;