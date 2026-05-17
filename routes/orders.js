const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const { verifyToken, verifyManager } = require('../middleware/auth');
const {
  sendOrderConfirmationEmail,
  sendOrderStatusEmail
} = require('../utils/email');

// ── GET ALL ORDERS (Manager only) ──────────────────────────
router.get('/', verifyManager, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM view_order_summary ORDER BY order_date DESC');
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET MY ORDERS (logged in customer) ─────────────────────
router.get('/my-orders', verifyToken, async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT * FROM view_order_summary WHERE cust_id = ? ORDER BY order_date DESC',
      [req.user.cust_id]
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET SINGLE ORDER DETAILS ────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM view_order_details WHERE order_id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Build order object
    const order = {
      order_id:       rows[0].order_id,
      order_date:     rows[0].order_date,
      status:         rows[0].status,
      payment_method: rows[0].payment_method,
      customer_name:  rows[0].customer_name,
      customer_email: rows[0].customer_email,
      items: rows.map(r => ({
        prod_id:      r.prod_id,
        p_name:       r.product_name,
        price:        r.price,
        quantity:     r.quantity,
        line_total:   r.line_total
      })),
      total: rows.reduce((sum, r) => sum + Number(r.line_total), 0)
    };

    res.json({ success: true, data: order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PLACE ORDER ─────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  const { payment_method, delivery_address, notes, items } = req.body;
  const cust_id = req.user.cust_id;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order must have at least one item.' });
  }
  if (!payment_method) {
    return res.status(400).json({ success: false, message: 'Payment method is required.' });
  }

  const conn = await (await import('../db/connection.js')).default.getConnection?.() 
    ?? await require('../db/connection').getConnection();

  try {
    await db.query('START TRANSACTION');

    // Insert order
    const [orderResult] = await db.query(
      `INSERT INTO orders 
        (payment_method, status, confirmation_sent, delivery_address, notes, cust_id) 
       VALUES (?, 'confirmed', 0, ?, ?, ?)`,
      [payment_method, delivery_address || null, notes || null, cust_id]
    );
    const order_id = orderResult.insertId;

    // Insert order items
    for (const item of items) {
      await db.query(
        'INSERT INTO has (order_id, prod_id, quantity) VALUES (?, ?, ?)',
        [order_id, item.prod_id, item.quantity]
      );
    }

    // Assign a staff member to process the order
    const [staff] = await db.query(
      `SELECT staff_id FROM bakery_staff 
       WHERE role IN ('Cashier', 'Manager') LIMIT 1`
    );
    if (staff.length > 0) {
      await db.query(
        'INSERT INTO processes (staff_id, order_id) VALUES (?, ?)',
        [staff[0].staff_id, order_id]
      );
    }

    await db.query('COMMIT');

    // Fetch full order details for confirmation email
    const [orderRows] = await db.query(
      'SELECT * FROM view_order_details WHERE order_id = ?', [order_id]
    );

    const orderData = {
      order_id,
      order_date:     new Date(),
      status:         'confirmed',
      payment_method,
      items: orderRows.map(r => ({
        p_name:   r.product_name,
        price:    r.price,
        quantity: r.quantity
      })),
      total: orderRows.reduce((sum, r) => sum + Number(r.line_total), 0)
    };

    // Get customer email
    const [custRows] = await db.query(
      'SELECT name, email FROM customer WHERE cust_id = ?', [cust_id]
    );

    // Send confirmation email
    await sendOrderConfirmationEmail(
      custRows[0].email,
      custRows[0].name,
      orderData
    );

    // Mark confirmation sent
    await db.query(
      'UPDATE orders SET confirmation_sent = 1 WHERE order_id = ?', [order_id]
    );

    res.status(201).json({
      success: true,
      message: 'Order placed successfully! Confirmation email sent.',
      order_id
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Order error:', err);
    res.status(500).json({ success: false, message: 'Server error placing order.' });
  }
});

// ── UPDATE ORDER STATUS (Manager only) ─────────────────────
router.patch('/:id/status', verifyManager, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending','confirmed','preparing','ready','delivered','cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  try {
    await db.query(
      'UPDATE orders SET status = ? WHERE order_id = ?',
      [status, req.params.id]
    );

    // Send status update email to customer
    const [rows] = await db.query(
      `SELECT c.email, c.name FROM orders o 
       JOIN customer c ON o.cust_id = c.cust_id 
       WHERE o.order_id = ?`,
      [req.params.id]
    );

    if (rows.length > 0) {
      await sendOrderStatusEmail(
        rows[0].email,
        rows[0].name,
        req.params.id,
        status
      );
    }

    res.json({ success: true, message: `Order status updated to ${status}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE ORDER (Manager only) ─────────────────────────────
router.delete('/:id', verifyManager, async (req, res) => {
  try {
    await db.query('DELETE FROM orders WHERE order_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Order deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;