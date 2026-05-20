const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../db/connection');
const { verifyToken } = require('../middleware/auth');
const {
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../utils/email');
require('dotenv').config();

// ── REGISTER ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, phoneno, address } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  try {
    // Check if email already exists
    const [existing] = await db.query(
      'SELECT cust_id FROM customer WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Hash password + generate verification token
    const password_hash = await bcrypt.hash(password, 10);
    const verify_token  = crypto.randomBytes(32).toString('hex');

    // Insert customer
    const [result] = await db.query(
      'INSERT INTO customer (name, email, password_hash, is_verified, verify_token) VALUES (?, ?, ?, 0, ?)',
      [name, email, password_hash, verify_token]
    );
    const cust_id = result.insertId;

    // Save phone number if provided
    if (phoneno && phoneno.trim()) {
      await db.query(
        'INSERT INTO customer_phone (cust_id, c_phoneno) VALUES (?, ?)',
        [cust_id, phoneno.trim()]
      );
    }

    // Save address if provided
    if (address && address.trim()) {
      await db.query(
        'INSERT INTO customer_address (cust_id, c_address) VALUES (?, ?)',
        [cust_id, address.trim()]
      );
    }

    // Send verification email
    await sendVerificationEmail(email, name, verify_token);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      cust_id
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
      return res.status(400).send(`
        <div style="font-family:Arial;text-align:center;padding:60px">
          <h2>❌ Invalid or expired verification link.</h2>
          <p>Please request a new verification email.</p>
        </div>
      `);
    }

    await db.query(
      'UPDATE customer SET is_verified = 1, verify_token = NULL WHERE verify_token = ?', [token]
    );

    res.send(`
      <div style="font-family:Arial;text-align:center;padding:60px;background:#FDF6EC;min-height:100vh">
        <div style="background:#fff;border-radius:14px;padding:40px;max-width:500px;margin:0 auto;box-shadow:0 4px 24px rgba(139,69,19,0.12)">
          <div style="font-size:4rem">🎉</div>
          <h1 style="color:#5C2E00;font-family:Georgia,serif">Email Verified!</h1>
          <p style="color:#7A5C4A;font-size:1.1rem">Your Sweet Crust Bakery account is now active.</p>
          <p style="color:#7A5C4A">You can now login and start ordering!</p>
          <a href="${process.env.BASE_URL}"
             style="display:inline-block;margin-top:20px;background:#8B4513;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:500">
            Go to Homepage
          </a>
        </div>
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
        message: 'Please verify your email before logging in. Check your inbox!'
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

// ── GET MY PROFILE ──────────────────────────────────────────
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const [customer] = await db.query(
      'SELECT cust_id, name, email, created_at FROM customer WHERE cust_id = ?',
      [req.user.cust_id]
    );
    if (customer.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const [phones] = await db.query(
      'SELECT c_phoneno FROM customer_phone WHERE cust_id = ?',
      [req.user.cust_id]
    );
    const [addresses] = await db.query(
      'SELECT c_address FROM customer_address WHERE cust_id = ?',
      [req.user.cust_id]
    );

    res.json({
      success: true,
      data: {
        ...customer[0],
        phones:    phones.map(p => p.c_phoneno),
        addresses: addresses.map(a => a.c_address)
      }
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── UPDATE PROFILE ──────────────────────────────────────────
router.put('/profile', verifyToken, async (req, res) => {
  const { name, phoneno, address } = req.body;
  const cust_id = req.user.cust_id;

  try {
    // Update name if provided
    if (name && name.trim()) {
      await db.query(
        'UPDATE customer SET name = ? WHERE cust_id = ?',
        [name.trim(), cust_id]
      );
    }

    // Add new phone number if provided
    if (phoneno && phoneno.trim()) {
      await db.query(
        'INSERT IGNORE INTO customer_phone (cust_id, c_phoneno) VALUES (?, ?)',
        [cust_id, phoneno.trim()]
      );
    }

    // Add new address if provided
    if (address && address.trim()) {
      await db.query(
        'INSERT IGNORE INTO customer_address (cust_id, c_address) VALUES (?, ?)',
        [cust_id, address.trim()]
      );
    }

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE PHONE NUMBER ─────────────────────────────────────
router.delete('/profile/phone', verifyToken, async (req, res) => {
  const { phoneno } = req.body;
  try {
    await db.query(
      'DELETE FROM customer_phone WHERE cust_id = ? AND c_phoneno = ?',
      [req.user.cust_id, phoneno]
    );
    res.json({ success: true, message: 'Phone number removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE ADDRESS ──────────────────────────────────────────
router.delete('/profile/address', verifyToken, async (req, res) => {
  const { address } = req.body;
  try {
    await db.query(
      'DELETE FROM customer_address WHERE cust_id = ? AND c_address = ?',
      [req.user.cust_id, address]
    );
    res.json({ success: true, message: 'Address removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── FORGOT PASSWORD ─────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }
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

    res.json({ success: true, message: 'Password reset email sent! Check your inbox.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── RESET PASSWORD ──────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Token and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM customer WHERE reset_token = ? AND reset_expires > NOW()', [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token. Please request a new one.' });
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