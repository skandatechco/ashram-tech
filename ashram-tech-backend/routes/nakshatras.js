const express = require("express");
const router = express.Router();
const pool = require("../db"); // Correct: use 'pool'

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, Nakshatra AS name FROM nakshatras"
    );

    res.json(rows);
  } catch (err) {
    console.error("Nakshatra fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch Nakshatras."
    });
  }
});

module.exports = router;
