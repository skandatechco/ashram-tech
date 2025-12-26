const express = require("express");
const router = express.Router();
const supabase = require("../database");

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("nakshatras")
      .select("id, name:english_name");

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching nakshatras:", err);
    res.status(500).json({ success: false, message: "DB error" });
  }
});

module.exports = router;
