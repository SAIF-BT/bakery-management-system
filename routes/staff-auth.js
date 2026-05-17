const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/connection');
require('dotenv').config();

// ── SET MANAGER PASSWORD (first time setup) ─────────────────
router.post('/set-password', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT m.staff_id FROM manager m
       JOIN bakery_staff bs ON m.staff_id = bs.staff_id
       WHERE m.email = ?`, [email]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Manager email not found.' });
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'UPDATE manager SET password_hash = ? WHERE email = ?', [hash, email]
    );
    res.json({ success: true, message: 'Password set successfully! You can now login.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── MANAGER LOGIN ───────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT m.staff_id, m.email, m.password_hash,
              bs.name, bs.role
       FROM manager m
       JOIN bakery_staff bs ON m.staff_id = bs.staff_id
       WHERE m.email = ?`, [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const mgr = rows[0];
    if (!mgr.password_hash) {
      return res.status(403).json({
        success: false,
        message: 'Password not set yet. Please set your password first using /api/staff-auth/set-password'
      });
    }
    const isMatch = await bcrypt.compare(password, mgr.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const token = jwt.sign(
      { staff_id: mgr.staff_id, name: mgr.name, email: mgr.email, role: mgr.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      success: true,
      message: 'Manager login successful!',
      token,
      user: { staff_id: mgr.staff_id, name: mgr.name, email: mgr.email, role: mgr.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;