const express = require("express");
const router = express.Router();
const pool = require("../database");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

// -------------------------------
// Initialize Razorpay
// -------------------------------
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// -------------------------------
// Create Booking + Razorpay Order
// POST /api/bookings/create
// -------------------------------
router.post("/create", async (req, res) => {
    let connection;

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
            return res.status(400).json({
                success: false,
                message: "pooja_id, full_name, email, and amount are required."
            });
        }

        const amountNumber = parseFloat(amount);
        if (isNaN(amountNumber) || amountNumber <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount."
            });
        }

        const preferredDate = preferred_date?.trim() || null;
        const preferredTime = preferred_time?.trim() || null;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Insert booking
        const insertQuery = `
            INSERT INTO bookings (
                pooja_id, full_name, email, phone, nakshatra, gotra,
                preferred_date, preferred_time, sankalpam, amount
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await connection.query(insertQuery, [
            pooja_id,
            full_name,
            email,
            phone || null,
            nakshatra || null,
            gotra || null,
            preferredDate,
            preferredTime,
            sankalpam || null,
            amountNumber
        ]);

        const booking_id = result.insertId;

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: Math.round(amountNumber * 100),
            currency: "INR",
            receipt: `booking_${booking_id}`,
            payment_capture: 1
        });

        // Save order ID in DB
        await connection.query(
            "UPDATE bookings SET payment_link = ? WHERE id = ?",
            [order.id, booking_id]
        );

        await connection.commit();

        return res.json({
            success: true,
            booking_id,
            order_id: order.id,
            amount: Math.round(amountNumber * 100),
            currency: "INR",
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error creating booking:", error);
        return res.status(500).json({
            success: false,
            message: "Booking creation failed.",
            error: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// -------------------------------
// Verify Payment
// POST /api/bookings/verify
// -------------------------------
router.post("/verify", async (req, res) => {
    const { 
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        booking_id
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !booking_id) {
        return res.status(400).json({
            success: false,
            message: "Missing payment details."
        });
    }

    try {
        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const digest = hmac.digest("hex");

        if (digest !== razorpay_signature) {
            await pool.query(
                'UPDATE bookings SET payment_status="failed" WHERE id = ?',
                [booking_id]
            );
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature."
            });
        }

        await pool.query(
            'UPDATE bookings SET payment_status="paid" WHERE id = ?',
            [booking_id]
        );

        return res.json({
            success: true,
            message: "Payment verified successfully!"
        });

    } catch (error) {
        console.error("Payment verification error:", error);
        return res.status(500).json({
            success: false,
            message: "Payment verification failed."
        });
    }
});

// Test route
router.get("/", (req, res) => {
    res.json({ message: "Bookings API working!" });
});

module.exports = router;
