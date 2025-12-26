const express = require("express");
const router = express.Router();
const supabase = require("../database");

/**
 * GET /api/poojas
 * Optional query: ?name=Ganapathi
 */
router.get("/", async (req, res) => {
  try {
    const { name } = req.query;

    if (name) {
      // Get pooja by name
      const { data, error } = await supabase
        .from("poojas")
        .select("*")
        .eq("name", name)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ success: false, message: "Pooja not found" });
        }
        throw error;
      }

      return res.json({ success: true, data });
    }

    // Get all poojas
    const { data, error } = await supabase
      .from("poojas")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching poojas:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

/**
 * GET /api/poojas/category/:category_id
 */
router.get("/category/:category_id", async (req, res) => {
  try {
    const category_id = Number(req.params.category_id);
    if (!category_id) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const { data, error } = await supabase
      .from("poojas")
      .select("*")
      .eq("category_id", category_id)
      .order("id", { ascending: true });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching poojas by category:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

/* =========================
   ADMIN ROUTES
========================= */

/**
 * POST /api/poojas/admin
 */
router.post("/admin", async (req, res) => {
  const { category_id, name, description = "", amount } = req.body;

  if (!category_id || !name || !amount) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    const { error } = await supabase
      .from("poojas")
      .insert([{ category_id, name, description, amount }]);

    if (error) throw error;

    res.json({ success: true, message: "Pooja added successfully" });
  } catch (err) {
    console.error("Admin add pooja error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

/**
 * PUT /api/poojas/admin/:id
 */
router.put("/admin/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { category_id, name, description, amount } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: "Invalid pooja ID" });
  }

  try {
    const { error } = await supabase
      .from("poojas")
      .update({ category_id, name, description, amount })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true, message: "Pooja updated successfully" });
  } catch (err) {
    console.error("Admin update pooja error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

/**
 * DELETE /api/poojas/admin/:id
 */
router.delete("/admin/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ success: false, message: "Invalid pooja ID" });
  }

  try {
    const { error } = await supabase
      .from("poojas")
      .delete()
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true, message: "Pooja deleted successfully" });
  } catch (err) {
    console.error("Admin delete pooja error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

module.exports = router;
