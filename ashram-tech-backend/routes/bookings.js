import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function BookingPage() {
  const [poojas, setPoojas] = useState([]);
  const [nakshatras, setNakshatras] = useState([]);
  const [selectedPooja, setSelectedPooja] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    nakshatra_id: "",
    gotra: "",
    preferred_date: "",
    preferred_time: "",
    sankalpam: ""
  });

  const query = new URLSearchParams(window.location.search);
  const poojaNameFromURL = query.get("name");

  // Load poojas
  useEffect(() => {
    async function fetchPoojas() {
      const { data, error } = await supabase.from("poojas").select("*");
      if (error) return console.error("Supabase error:", error);
      setPoojas(data);

      if (poojaNameFromURL) {
        const pooja = data.find(p => p.name === poojaNameFromURL);
        if (pooja) setSelectedPooja(pooja);
      }
    }
    fetchPoojas();
  }, [poojaNameFromURL]);

  // Load nakshatras
  useEffect(() => {
    async function fetchNakshatras() {
      const { data, error } = await supabase
        .from("nakshatras")
        .select("*")
        .order("name");
      if (error) return console.error("Supabase error:", error);
      setNakshatras(data);
    }
    fetchNakshatras();
  }, []);

  // Handle form field change
  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // Handle pooja selection
  const handlePoojaSelect = (e) => {
    const pooja = poojas.find(p => p.id === parseInt(e.target.value));
    setSelectedPooja(pooja);
  };

  // Handle booking submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPooja) return alert("Please select a pooja.");

    try {
      // 1️⃣ Create booking in backend
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          pooja_id: selectedPooja.id,
          amount: selectedPooja.amount
        })
      });
      const booking = await bookingRes.json();
      if (!booking?.id) throw new Error("Booking creation failed");

      // 2️⃣ Create Razorpay order
      const orderRes = await fetch("/api/bookings/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id, amount: selectedPooja.amount * 100 })
      });
      const order = await orderRes.json();
      if (!order?.order_id) throw new Error("Razorpay order creation failed");

      // 3️⃣ Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "Pooja Booking",
        description: selectedPooja.name,
        prefill: {
          name: formData.full_name,
          email: formData.email,
          contact: formData.phone
        },
        theme: { color: "#F37254" },
        handler: async (response) => {
          // 4️⃣ Verify payment
          const verifyRes = await fetch("/api/bookings/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              booking_id: booking.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          const verify = await verifyRes.json();
          if (verify.success) {
            alert("✅ Payment successful!");
            window.location.href = "/thank-you.html";
          } else {
            alert("❌ Payment verification failed");
          }
        }
      });

      rzp.open();
    } catch (err) {
      console.error(err);
      alert("Booking failed: " + err.message);
    }
  };

  return (
    <div className="booking-container">
      <h2>Pooja Booking</h2>
      {selectedPooja && <h3>{selectedPooja.name}</h3>}

      <form onSubmit={handleSubmit}>
        <label>Select Pooja</label>
        <select onChange={handlePoojaSelect} value={selectedPooja?.id || ""} required>
          <option value="">Select a Pooja</option>
          {poojas.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} - ₹{p.amount}
            </option>
          ))}
        </select>

        <label>Full Name</label>
        <input name="full_name" value={formData.full_name} onChange={handleChange} required />

        <label>Email</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} required />

        <label>Phone</label>
        <input name="phone" value={formData.phone} onChange={handleChange} />

        <label>Select Nakshatra</label>
        <select name="nakshatra_id" value={formData.nakshatra_id} onChange={handleChange} required>
          <option value="">Select Nakshatra</option>
          {nakshatras.map(n => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>

        <label>Gotra</label>
        <input name="gotra" value={formData.gotra} onChange={handleChange} />

        <label>Preferred Date</label>
        <input type="date" name="preferred_date" value={formData.preferred_date} onChange={handleChange} />

        <label>Preferred Time</label>
        <input type="time" name="preferred_time" value={formData.preferred_time} onChange={handleChange} />

        <label>Sankalpam</label>
        <textarea name="sankalpam" value={formData.sankalpam} onChange={handleChange} />

        <label>Amount (₹)</label>
        <input type="number" value={selectedPooja?.amount || 0} readOnly />

        <button type="submit">Book & Pay</button>
      </form>
    </div>
  );
}
const express = require("express");
const Razorpay = require("razorpay");
const supabase = require("../supabaseClient"); // your Supabase client
const crypto = require("crypto");

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// -------------------
// CREATE BOOKING
// -------------------
router.post("/", async (req, res) => {
  try {
    const booking = {
      pooja_id: Number(req.body.pooja_id),
      full_name: req.body.full_name,
      email: req.body.email,
      phone: req.body.phone || null,
      nakshatra_id: req.body.nakshatra_id ? Number(req.body.nakshatra_id) : null,
      gotra: req.body.gotra || null,
      preferred_date: req.body.preferred_date || null,
      preferred_time: req.body.preferred_time || null,
      sankalpam: req.body.sankalpam || null,
      status: "pending"
    };

    // 🔒 Fetch real amount
    const { data: pooja, error: poojaError } = await supabase
      .from("poojas")
      .select("amount")
      .eq("id", booking.pooja_id)
      .single();

    if (poojaError) throw poojaError;
    booking.amount = pooja.amount;

    const { data, error } = await supabase
      .from("bookings")
      .insert([booking])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error("BOOKING ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------
// CREATE RAZORPAY ORDER
// -------------------
router.post("/create-order", async (req, res) => {
  try {
    const { booking_id, amount } = req.body;

    if (!booking_id || !amount) {
      return res.status(400).json({ success: false, message: "Booking ID and amount are required" });
    }

    const order = await razorpay.orders.create({
      amount, // in paise
      currency: "INR",
      receipt: `booking_${booking_id}`,
      payment_capture: 1
    });

    // Save Razorpay order ID in Supabase
    await supabase
      .from("bookings")
      .update({ razorpay_order_id: order.id })
      .eq("id", booking_id);

    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("Razorpay order creation error:", err);
    res.status(500).json({ success: false, message: "Failed to create Razorpay order", error: err.message });
  }
});

// -------------------
// VERIFY PAYMENT
// -------------------
router.post("/verify-payment", async (req, res) => {
  try {
    const { booking_id, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!booking_id || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Incomplete payment info" });
    }

    // Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await supabase
        .from("bookings")
        .update({ status: "failed" })
        .eq("id", booking_id);
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Mark booking as paid
    await supabase
      .from("bookings")
      .update({ razorpay_payment_id, status: "paid" })
      .eq("id", booking_id);

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({ success: false, message: "Payment verification failed", error: err.message });
  }
});


module.exports = router;
