const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// API routes
app.use("/api/nakshatras", require("./routes/nakshatras"));
// ...other routes
app.use("/api/poojas", require("./routes/poojas"));
app.use("/api/bookings", require("./routes/bookings"));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
