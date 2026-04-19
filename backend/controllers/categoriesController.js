// controllers/categoriesController.js
const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

// GET /api/categories
exports.getCategories = async (req, res) => {
  const r = await pool.query(`SELECT id, name FROM categories ORDER BY id ASC`);
  res.json({ categories: r.rows });
};

// POST /api/categories
exports.createCategory = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name is required" });
  const r = await pool.query(
    `INSERT INTO categories (name) VALUES ($1) RETURNING id, name`,
    [name.trim()]
  );
  await writeAudit({
    req,
    action: "CATEGORY_CREATE",
    entity: "CATEGORY",
    entity_id: r.rows[0].id,
    actor_user_id: req.user?.id,
    actor_email: req.user?.email,
    actor_role: req.user?.role,
    details: r.rows[0],
  });
  res.status(201).json({ category: r.rows[0] });
};

// PUT /api/categories/:id
exports.updateCategory = async (req, res) => {
  const id = req.params.id;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name is required" });
  const r = await pool.query(
    `UPDATE categories SET name=$1 WHERE id=$2 RETURNING id, name`,
    [name.trim(), id]
  );
  if (r.rowCount === 0) return res.status(404).json({ message: "Category not found" });
  await writeAudit({
    req,
    action: "CATEGORY_UPDATE",
    entity: "CATEGORY",
    entity_id: id,
    actor_user_id: req.user?.id,
    actor_email: req.user?.email,
    actor_role: req.user?.role,
    details: r.rows[0],
  });
  res.json({ category: r.rows[0] });
};

// DELETE /api/categories/:id
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if any active items use this category
    const itemCheck = await pool.query(
      `SELECT COUNT(*) as count FROM items WHERE category_id = $1 AND active = TRUE`,
      [id]
    );

    if (parseInt(itemCheck.rows[0].count) > 0) {
      return res.status(400).json({
        message: `Cannot delete category — ${itemCheck.rows[0].count} active item(s) are assigned to it. Move or delete those items first.`,
      });
    }

    const r = await pool.query(
      `DELETE FROM categories WHERE id = $1 RETURNING id, name`,
      [id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    await writeAudit({
      req,
      action: "CATEGORY_DELETE",
      entity: "CATEGORY",
      entity_id: id,
      actor_user_id: req.user?.id,
      actor_email: req.user?.email,
      actor_role: req.user?.role,
      details: r.rows[0],
    });

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);
    res.status(500).json({ message: "Failed to delete category" });
  }
};