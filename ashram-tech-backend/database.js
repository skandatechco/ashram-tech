const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Bahola#1234',
    database: process.env.DB_NAME || 'pooja_booking',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the MySQL connection
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log("✅ MySQL connected!");
        conn.release();
    } catch (err) {
        console.error("❌ MySQL connection failed:", err.message);
        process.exit(1);
    }
})();

module.exports = pool;
