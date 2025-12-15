const express = require('express');
const router = express.Router();
const db = require('../database');

// Payment callback (GET)
router.get('/callback', (req, res) => {
  const booking_id = req.query.booking_id;

  // In a real setup, you’d verify webhook or payment status
  db.query(
    `UPDATE bookings SET payment_status = 'paid' WHERE id = ?`,
    [booking_id],
    (err) => {
      if (err) return res.status(500).send('Error updating payment status');
      res.send('✅ Payment received. Thank you for your donation.');
    }
  );
});

module.exports = router;
