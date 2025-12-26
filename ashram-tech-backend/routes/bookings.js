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
    sankalpam: "",
  });

  // Get pooja from URL
  const query = new URLSearchParams(window.location.search);
  const poojaNameFromURL = query.get("name");

  // Load Poojas
  useEffect(() => {
    async function fetchPoojas() {
      const { data, error } = await supabase.from("poojas").select("*");
      if (error) return console.error(error);
      setPoojas(data);

      if (poojaNameFromURL) {
        const pooja = data.find(p => p.name === poojaNameFromURL);
        if (pooja) setSelectedPooja(pooja);
      }
    }
    fetchPoojas();
  }, [poojaNameFromURL]);

  // Load Nakshatras
  useEffect(() => {
    async function fetchNakshatras() {
      const { data, error } = await supabase.from("nakshatras").select("*").order("name");
      if (error) return console.error(error);
      setNakshatras(data);
    }
    fetchNakshatras();
  }, []);

  // Handle form change
  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Handle pooja select
  const handlePoojaSelect = (e) => {
    const pooja = poojas.find(p => p.id === parseInt(e.target.value));
    setSelectedPooja(pooja);
  };

  // Submit booking + Razorpay
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPooja) return alert("Please select a pooja.");

    try {
      // 1️⃣ Save booking in Supabase
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert([{
          ...formData,
          pooja_id: selectedPooja.id,
          amount: selectedPooja.amount,
          status: "pending"
        }])
        .select()
        .single();
      if (error) throw error;

      // 2️⃣ Call backend to create Razorpay order
      const res = await fetch("https://your-backend.com/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id, amount: selectedPooja.amount * 100 })
      });
      const order = await res.json();
      if (!order.success) throw new Error("Order creation failed");

      // 3️⃣ Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: "INR",
        order_id: order.order_id,
        name: "Pooja Booking",
        description: selectedPooja.name,
        handler: async function (response) {
          // 4️⃣ Verify payment
          const verifyRes = await fetch("https://your-backend.com/verify-payment", {
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
        },
        prefill: {
          name: formData.full_name,
          email: formData.email,
          contact: formData.phone
        },
        theme: { color: "#F37254" }
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
        <input type="number" value={selectedPooja ? selectedPooja.amount : 0} readOnly />

        <button type="submit">Book & Pay</button>
      </form>
    </div>
  );
}
const express = require("express");
const Razorpay = require("razorpay");
const supabase = require("../supabaseClient");

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* CREATE BOOKING */
router.post("/", async (req, res) => {
  try {
    const booking = req.body;

    const { data, error } = await supabase
      .from("bookings")
      .insert([booking])
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* CREATE RAZORPAY ORDER */
router.post("/create-order", async (req, res) => {
  try {
    const { booking_id, amount } = req.body;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: booking_id
    });

    await supabase
      .from("bookings")
      .update({ razorpay_order_id: order.id })
      .eq("id", booking_id);

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: "INR",
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* VERIFY PAYMENT */
router.post("/verify-payment", async (req, res) => {
  try {
    const {
      booking_id,
      razorpay_payment_id,
      razorpay_order_id
    } = req.body;

    await supabase
      .from("bookings")
      .update({
        razorpay_payment_id,
        status: "paid"
      })
      .eq("id", booking_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
