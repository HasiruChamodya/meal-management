// controllers/ingredientsController.js
const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

// GET /api/ingredients
exports.getIngredients = async (req, res) => {
  const r = await pool.query(`SELECT id, name FROM ingredients ORDER BY name ASC`);
  res.json({ ingredients: r.rows });
};

// POST /api/ingredients
exports.createIngredient = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name is required" });

  const r = await pool.query(
    `INSERT INTO ingredients (name) VALUES ($1) RETURNING id, name`,
    [name.trim()]
  );

  await writeAudit({
    req,
    action: "INGREDIENT_CREATE",
    entity: "INGREDIENT",
    entity_id: r.rows[0].id,
    actor_user_id: req.user?.id,
    actor_email: req.user?.email,
    actor_role: req.user?.role,
    details: r.rows[0],
  });

  res.status(201).json({ ingredient: r.rows[0] });
};