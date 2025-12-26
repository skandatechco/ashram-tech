const express = require('express');
const router = express.Router();
const pool = require('../db'); // pg Pool

// Payment callback (GET)
router.get('/callback', async (req, res) => {
  const booking_id = req.query.booking_id;

  if (!booking_id) {
    return res.status(400).send('Booking ID is required.');
  }

  try {
    // Update payment_status in PostgreSQL
    await pool.query(
      "UPDATE bookings SET payment_status = 'paid' WHERE id = $1",
      [booking_id]
    );

    res.send('✅ Payment received. Thank you for your donation.');
  } catch (err) {
    console.error('Error updating payment status:', err);
    res.status(500).send('Error updating payment status');
  }
});

module.exports = router;
