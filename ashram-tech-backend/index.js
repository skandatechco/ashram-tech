const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const poojasRoutes = require("./routes/poojas");
const nakshatrasRoutes = require("./routes/nakshatras");
const bookingsRoutes = require("./routes/bookings");

require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/api/poojas", poojasRoutes);
app.use("/api/nakshatras", nakshatrasRoutes);
app.use("/api/bookings", bookingsRoutes);

// Test route
app.get("/", (req, res) => res.send("API is running!"));

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
