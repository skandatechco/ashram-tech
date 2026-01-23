const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const supabase = require('./database'); // Make sure this file exists and is correctly set up
require('dotenv').config();

// Routes
const poojasRoutes = require('./routes/poojas');
const nakshatrasRoutes = require('./routes/nakshatras');
const bookingsRoutes = require('./routes/bookings');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/poojas', poojasRoutes);
app.use('/api/nakshatras', nakshatrasRoutes);
app.use('/api/bookings', bookingsRoutes);

// Test route
app.get('/', (req, res) => res.send('API is running 🚀'));

// Razorpay Init
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Health check
app.get('/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('poojas')
      .select('*')
      .limit(1);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Razorpay payment verification endpoint
app.post('/api/bookings/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !booking_id) {
      return res.status(400).json({ success: false, message: 'Missing payment data' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await supabase
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('id', booking_id);
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    await supabase
      .from('bookings')
      .update({ payment_status: 'paid', razorpay_payment_id })
      .eq('id', booking_id);

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
