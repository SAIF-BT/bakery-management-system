require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/staff',      require('./routes/staff'));
app.use('/api/inventory',  require('./routes/inventory'));
app.use('/api/suppliers',  require('./routes/suppliers'));
app.use('/api/staff-auth', require('./routes/staff-auth'));
app.use('/api/customers', require('./routes/customers'));

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '🍰 Sweet Crust Bakery API is running!' });
});

// ── Serve frontend ───────────────────────────────────────────
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start server ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🍰 Sweet Crust Bakery Server running on http://localhost:${PORT}`);
});