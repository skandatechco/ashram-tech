require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const supabase = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------------- */
/* Middleware */
/* -------------------------- */
app.use(cors());
app.use(express.json());

/* -------------------------- */
/* Razorpay */
/* -------------------------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* -------------------------- */
/* Helpers */
/* -------------------------- */
const sendError = (res, message, status = 500) =>
  res.status(status).json({ success: false, message });

const isValidAmount = (amount) => 
  !isNaN(amount) && Number(amount) > 0;

/* -------------------------- */
/* Health Check */
/* -------------------------- */
app.get("/", (_, res) => {
  res.send("API running on Railway 🚀");
});

/* -------------------------- */
/* Poojas */
/* -------------------------- */
app.get("/api/poojas", async (_, res) => {
  try {
    const { data, error } = await supabase
      .from("poojas")
      .select("*")
      .order("id");

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    sendError(res, "Failed to fetch poojas");
  }
});

app.get("/api/poojas/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("poojas")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return sendError(res, "Pooja not found", 404);
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    sendError(res, "Failed to fetch pooja");
  }
});

/* -------------------------- */
/* Nakshatras */
/* -------------------------- */
app.get("/api/nakshatras", async (_, res) => {
  try {
    const { data, error } = await supabase
      .from("nakshatras")
      .select("id, english_name")
      .order("id");

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    sendError(res, "Failed to fetch nakshatras");
  }
});

/* -------------------------- */
/* Create Booking */
/* -------------------------- */
app.post("/api/bookings", async (req, res) => {
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
      amount,
    } = req.body;

    if (!pooja_id || !full_name || !email || !isValidAmount(amount)) {
      return sendError(res, "Invalid or missing fields", 400);
    }

    const bookingAmount = Number(amount);

    const { data: booking, error } = await supabase
      .from("bookings")
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
        amount: bookingAmount,
        payment_status: "pending",
      })
      .select("id")
      .single();

    if (error) throw error;

    const order = await razorpay.orders.create({
      amount: Math.round(bookingAmount * 100),
      currency: "INR",
      receipt: `booking_${booking.id}`,
      payment_capture: 1,
    });

    await supabase
      .from("bookings")
      .update({ razorpay_order_id: order.id })
      .eq("id", booking.id);

    res.json({
      success: true,
      booking_id: booking.id,
      order_id: order.id,
      amount: order.amount,
      currency: "INR",
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Booking failed");
  }
});

/* -------------------------- */
/* Verify Payment */
/* -------------------------- */
app.post("/api/bookings/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      booking_id,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !booking_id
    ) {
      return sendError(res, "Missing payment data", 400);
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await supabase
        .from("bookings")
        .update({ payment_status: "failed" })
        .eq("id", booking_id);

      return sendError(res, "Invalid signature", 400);
    }

    await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        razorpay_payment_id,
      })
      .eq("id", booking_id);

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    console.error(err);
    sendError(res, "Verification failed");
  }
});

/* -------------------------- */
/* Server */
/* -------------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
