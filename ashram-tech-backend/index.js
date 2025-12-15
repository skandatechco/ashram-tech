const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const pool = require('./database'); // Make sure you have a proper MySQL connection pool setup

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(cors());

// Get all poojas
app.get('/api/poojas', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM poojas");
        res.json(rows);
    } catch (err) {
        console.error("Error fetching poojas:", err);  // Detailed error logging
        res.status(500).json({ error: err.message });
    }
});

// Get pooja by ID// Load poojas by category
async function loadPoojas(categoryId) {
  try {
    const res = await fetch(`http://localhost:3000/api/poojas/${categoryId}`);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error("Failed to load poojas:", err);
  }
}

// Load nakshatras
async function loadNakshatras() {
  try {
    const res = await fetch("http://localhost:3000/api/nakshatras");
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error("Failed to load Nakshatras:", err);
  }
}

app.get('/api/poojas/:id', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM poojas WHERE id = ?", [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: "Pooja not found" });
        res.json(rows[0]);
    } catch (err) {
        console.error("Error fetching pooja by ID:", err);  // Detailed error logging
        res.status(500).json({ error: err.message });
    }
});

// Get all nakshatras
app.get("/api/nakshatras", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, english_name AS name FROM nakshatras");
    res.json({ data: rows });
  } catch (err) {
    console.error("Error fetching nakshatras:", err);  // Detailed error logging
    res.status(500).json({ error: "Failed to fetch Nakshatras" });
  }
});

// Add booking
app.post('/api/bookings', async (req, res) => {
    try {
        const booking = req.body;
        console.log("Booking request received:", booking); // Log incoming request body
        
        // Check for necessary fields in the request body
        if (!booking.pooja_id || !booking.full_name || !booking.email || !booking.preferred_date || !booking.preferred_time) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const sql = `
            INSERT INTO bookings
            (pooja_id, full_name, email, phone, nakshatra, gotra, preferred_date, preferred_time, sankalpam, amount, payment_link, payment_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            booking.pooja_id, booking.full_name, booking.email, booking.phone,
            booking.nakshatra, booking.gotra, booking.preferred_date, booking.preferred_time,
            booking.sankalpam, booking.amount, booking.payment_link, booking.payment_status
        ];

        const [result] = await pool.query(sql, params);
        res.json({ message: "Booking created", bookingId: result.insertId });

    } catch (err) {
        console.error("Error creating booking:", err);  // Log error details for debugging
        res.status(500).json({ error: "Failed to create booking", details: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
