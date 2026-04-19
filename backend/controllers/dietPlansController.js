const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

// GET /api/diet-plans
exports.getAll = async (req, res) => {
  const r = await pool.query(
    "SELECT id, name, display_order, active FROM diet_plans ORDER BY display_order ASC"
  );
  res.json({ plans: r.rows });
};

// POST /api/diet-plans
exports.create = async (req, res) => {
  const { name, display_order = 1 } = req.body;

  const r = await pool.query(
    `INSERT INTO diet_plans (name, display_order)
     VALUES ($1,$2)
     RETURNING *`,
    [name, display_order]
  );

  res.status(201).json({ plan: r.rows[0] });
};

// PUT /api/diet-plans/:id
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, display_order } = req.body;

  const r = await pool.query(
    `UPDATE diet_plans
     SET name=$1, display_order=$2, updated_at=NOW()
     WHERE id=$3
     RETURNING *`,
    [name, display_order, id]
  );

  res.json({ plan: r.rows[0] });
};

// PATCH /api/diet-plans/:id/status
exports.toggle = async (req, res) => {
  const { id } = req.params;

  const r = await pool.query(
    `UPDATE diet_plans
     SET active = NOT active, updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    [id]
  );

  res.json({ plan: r.rows[0] });
};

// DELETE /api/diet-plans/:id
exports.remove = async (req, res) => {
  const { id } = req.params;

  await pool.query("DELETE FROM diet_plans WHERE id=$1", [id]);
  res.json({ message: "Deleted" });
};