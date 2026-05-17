const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 1. SERVE YOUR LOCAL FRONTEND SUBFOLDER
// This tells your server to serve index.html directly from your "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// 2. AIVEN DATABASE CONNECTION POOL
// This connects directly to your Aiven MySQL cloud instance using your local .env file
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test Database Connection
pool.getConnection()
  .then(conn => {
    console.log('✅ Successfully connected to Aiven MySQL Cloud Database!');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed. Check your .env file!', err.message);
  });

// 3. SAMPLE API ROUTE FOR TESTING
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. FALLBACK ROUTE
// If a user refreshes pages, always send them back to your local index.html file
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 5. LOCAL SERVER LISTENER
// This completely gets rid of the Vercel export setup and runs the server on your computer
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Sweet Crust Bakery server is alive at: http://localhost:${PORT}`);
});