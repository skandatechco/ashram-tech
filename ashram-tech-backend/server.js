require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const supabase = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------
// Middleware
// -------------------------
app.use(cors());
app.use(express.json());

// -------------------------
// Razorpay Init
// -------------------------
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// -------------------------
// Health check
// -------------------------
app.get('/', (req, res) => {
  res.send('API is running 🚀');
});
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
// -------------------------
// Poojas endpoints
// -------------------------
app.get('/api/poojas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('poojas')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch poojas' });
  }
});

app.get('/api/poojas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('poojas')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return res.status(404).json({ success: false, message: 'Pooja not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch pooja' });
  }
});

// -------------------------
// Nakshatras endpoint
// -------------------------
app.get('/api/nakshatras', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('nakshatras')
      .select('id, english_name')
      .order('id', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch nakshatras' });
  }
});

// -------------------------
// Create booking + Razorpay order
// -------------------------
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      pooja_id,
      full_name,
      email,
      phone,
      nakshatra,
      gotra,
      preferred_date,
      preferred_time,
      sankalpam,
      amount
    } = req.body;

    if (!pooja_id || !full_name || !email || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Insert booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        pooja_id,
        full_name,
        email,
        phone,
        nakshatra,
        gotra,
        preferred_date,
        preferred_time,
        sankalpam,
        amount: amountNumber,
        payment_status: 'pending'
      })
      .select('id')
      .single();

    if (error) throw error;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountNumber * 100, // paise
      currency: 'INR',
      receipt: `booking_${booking.id}`,
      payment_capture: 1
    });

    // Save order ID in booking
    await supabase
      .from('bookings')
      .update({ razorpay_order_id: order.id })
      .eq('id', booking.id);

    res.json({
      success: true,
      booking_id: booking.id,
      order_id: order.id,
      amount: order.amount,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Booking creation error:', err);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
});

// -------------------------
// Verify Razorpay payment
// -------------------------
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

// -------------------------
// Start server
// -------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
