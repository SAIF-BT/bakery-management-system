const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../db/connection');
const {
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../utils/email');
require('dotenv').config();

// ── REGISTER ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  try {
    // Check if email already exists
    const [existing] = await db.query('SELECT cust_id FROM customer WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Hash password + generate verification token
    const password_hash  = await bcrypt.hash(password, 10);
    const verify_token   = crypto.randomBytes(32).toString('hex');

    // Insert customer
    const [result] = await db.query(
      'INSERT INTO customer (name, email, password_hash, is_verified, verify_token) VALUES (?, ?, ?, 0, ?)',
      [name, email, password_hash, verify_token]
    );

    // Send verification email
    await sendVerificationEmail(email, name, verify_token);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      cust_id: result.insertId
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ── VERIFY EMAIL ────────────────────────────────────────────
router.get('/verify/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT cust_id FROM customer WHERE verify_token = ?', [token]
    );
    if (rows.length === 0) {
      return res.status(400).send('<h2>❌ Invalid or expired verification link.</h2>');
    }

    await db.query(
      'UPDATE customer SET is_verified = 1, verify_token = NULL WHERE verify_token = ?', [token]
    );

    res.send(`
      <div style="font-family:Arial;text-align:center;padding:60px">
        <h1>🎉 Email Verified!</h1>
        <p>Your Sweet Crust Bakery account is now active.</p>
        <a href="${process.env.BASE_URL}" 
           style="background:#8B4513;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none">
          Go to Homepage
        </a>
      </div>
    `);
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).send('<h2>Server error during verification.</h2>');
  }
});

// ── LOGIN ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM customer WHERE email = ?', [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const customer = rows[0];

    if (!customer.is_verified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Please verify your email before logging in.' 
      });
    }

    const isMatch = await bcrypt.compare(password, customer.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { cust_id: customer.cust_id, name: customer.name, email: customer.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        cust_id: customer.cust_id,
        name:    customer.name,
        email:   customer.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ── FORGOT PASSWORD ─────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT * FROM customer WHERE email = ?', [email]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Email not found.' });
    }

    const reset_token   = crypto.randomBytes(32).toString('hex');
    const reset_expires = new Date(Date.now() + 3600000); // 1 hour

    await db.query(
      'UPDATE customer SET reset_token = ?, reset_expires = ? WHERE email = ?',
      [reset_token, reset_expires, email]
    );

    await sendPasswordResetEmail(email, rows[0].name, reset_token);

    res.json({ success: true, message: 'Password reset email sent!' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── RESET PASSWORD ──────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT * FROM customer WHERE reset_token = ? AND reset_expires > NOW()', [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await db.query(
      'UPDATE customer SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE reset_token = ?',
      [password_hash, token]
    );

    res.json({ success: true, message: 'Password reset successful! You can now login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;