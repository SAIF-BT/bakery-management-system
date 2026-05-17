// 1. Force dotenv to load immediately at the top
require('dotenv').config();
const mysql = require('mysql2');

let pool;

// Print a quick check to your terminal to help us debug
console.log("🔍 Checking DATABASE_URL value:", process.env.DATABASE_URL ? "Found! ✅" : "NOT FOUND ❌");

if (process.env.DATABASE_URL) {
  // Cloud setup (Aiven) using the Service URI string
  pool = mysql.createPool({
    uri: process.env.DATABASE_URL, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} else {
  // Local development fallback
  pool = mysql.createPool({
    host:     process.env.DB_HOST || 'localhost',
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bakery_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

const db = pool.promise();

db.getConnection()
  .then(() => console.log('✅ MySQL cloud connected successfully via Aiven!'))
  .catch(err => console.error('❌ MySQL cloud connection failed:', err.message));

module.exports = db;