const express = require("express");
const router = express.Router();
const pool = require("../database");

// -------------------------
// GET /api/poojas/:category_id
// -------------------------
// Get poojas by category
router.get("/:category_id", async (req, res) => {
    const { category_id } = req.params;
    const [rows] = await pool.query(
        "SELECT * FROM poojas WHERE category_id = ? ORDER BY id ASC",
        [category_id]
    );
    res.json({ success: true, data: rows });
});

// Get pooja by name
router.get("/", async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ success: false, message: "Missing name" });
    const [rows] = await pool.query("SELECT * FROM poojas WHERE name = ? LIMIT 1", [name]);
    if (rows.length === 0) return res.json({ success: false, message: "Pooja not found" });
    res.json({ success: true, data: rows[0] });
});

router.get("/:category", async (req, res) => {
    const category = req.params.category;

    const category_id =
        category === "daily" ? 1 :
        category === "special" ? 2 :
        null;

    if (!category_id)
        return res.status(400).json({ success: false, message: "Invalid category" });

    const [rows] = await pool.query(
        "SELECT * FROM poojas WHERE category_id = ?",
        [category_id]
    );

    res.json({ success: true, data: rows });
});


// -------------------------
// GET /api/poojas?name=NAME
// -------------------------
router.get("/", async (req, res) => {
    const { name } = req.query;

    if (!name)
        return res.status(400).json({ success: false, message: "Missing name" });

    try {
        const [rows] = await pool.query(
            "SELECT * FROM poojas WHERE name = ?",
            [name]
        );

        if (rows.length === 0)
            return res.json({ success: false, message: "Pooja not found" });

        res.json({ success: true, data: rows[0] });

    } catch (err) {
        console.error("Error fetching pooja:", err);
        res.status(500).json({ success: false, message: "DB error" });
    }
});

// Get poojas by category (1=daily, 2=special)
router.get("/:category_id", async (req, res) => {
    try {
        const category_id = req.params.category_id;

        const [rows] = await pool.query(
            "SELECT * FROM poojas WHERE category_id = ?",
            [category_id]
        );

        res.json({ success: true, data: rows });

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Error fetching poojas" });
    }
});

// Search pooja by name (for details page)
router.get("/", async (req, res) => {
    const name = req.query.name;

    if (!name) {
        return res.json({ success: false, message: "Missing name" });
    }

    const [rows] = await pool.query(
        "SELECT * FROM poojas WHERE name = ? LIMIT 1",
        [name]
    );

    res.json({ success: true, data: rows[0] });
});
// -----------------------------
// ADMIN API — Add a new pooja
// -----------------------------
router.post("/admin", async (req, res) => {
    const { category_id, name, description, amount } = req.body;

    if (!category_id || !name || !amount)
        return res.status(400).json({ success: false, message: "Missing fields" });

    try {
        await pool.query(
            "INSERT INTO poojas (category_id, name, description, amount) VALUES (?, ?, ?, ?)",
            [category_id, name, description, amount]
        );

        res.json({ success: true, message: "Pooja added!" });

    } catch (err) {
        console.error("Admin add pooja error:", err);
        res.status(500).json({ success: false, message: "DB error" });
    }
});

// -----------------------------
// ADMIN API — Edit pooja
// -----------------------------
router.put("/admin/:id", async (req, res) => {
    const { id } = req.params;
    const { category_id, name, description, amount } = req.body;

    try {
        await pool.query(
            `UPDATE poojas
             SET category_id=?, name=?, description=?, amount=?
             WHERE id=?`,
            [category_id, name, description, amount, id]
        );

        res.json({ success: true, message: "Pooja updated" });

    } catch (err) {
        console.error("Admin edit pooja error:", err);
        res.status(500).json({ success: false, message: "DB error" });
    }
});

// -----------------------------
// ADMIN API — Delete pooja
// -----------------------------
router.delete("/admin/:id", async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query("DELETE FROM poojas WHERE id = ?", [id]);
        res.json({ success: true, message: "Deleted successfully" });

    } catch (err) {
        console.error("Admin delete error:", err);
        res.status(500).json({ success: false, message: "DB error" });
    }
});

module.exports = router;
