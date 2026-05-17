const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/staff-auth', require('./routes/staff-auth'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/staff',      require('./routes/staff'));
app.use('/api/inventory',  require('./routes/inventory'));
app.use('/api/suppliers',  require('./routes/suppliers'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '🍰 Sweet Crust Bakery API is running!', timestamp: new Date() });
});

// Standardized single-page application wildcard fallback route
app.get('/*any', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;

// Only listen to the port if we are running locally (Not in Vercel serverless environment)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`
  🍰 ================================
      Sweet Crust Bakery Server
      Running on http://localhost:${PORT}
  🍰 ================================
    `);
  });
}

// CRITICAL FOR VERCEL DEPLOYMENT:
module.exports = app;