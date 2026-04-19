// controllers/hospitalAdminController.js
const pool = require("../config/db");
const { logAudit } = require("../utils/auditLogger");

// GET /api/hospital-admin/wards
exports.getWards = async (req, res) => {
  const r = await pool.query("SELECT * FROM wards ORDER BY ward_name ASC");
  res.json({ wards: r.rows });
};

// POST /api/hospital-admin/wards
exports.createWard = async (req, res) => {
  const { ward_name, bed_count = 0, cot_count = 0, icu_count = 0 } = req.body;
  if (!ward_name?.trim()) return res.status(400).json({ message: "ward_name required" });

  const r = await pool.query(
    `INSERT INTO wards (ward_name, bed_count, cot_count, icu_count)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [ward_name.trim(), Number(bed_count) || 0, Number(cot_count) || 0, Number(icu_count) || 0]
  );

  await logAudit({
    actor_id: req.user?.id,
    actor_email: req.user?.email,
    module: "HOSPITAL_ADMIN",
    action: "WARD_CREATE",
    entity: "WARD",
    entity_id: r.rows[0].id,
    detail: `Created ward "${r.rows[0].ward_name}" (beds=${r.rows[0].bed_count}, cots=${r.rows[0].cot_count}, icu=${r.rows[0].icu_count})`,
    ip: req.ip,
  });

  res.status(201).json({ ward: r.rows[0] });
};

// PUT /api/hospital-admin/wards/:id
exports.updateWard = async (req, res) => {
  const id = Number(req.params.id);
  const { ward_name, bed_count = 0, cot_count = 0, icu_count = 0 } = req.body;
  if (!id) return res.status(400).json({ message: "Invalid id" });
  if (!ward_name?.trim()) return res.status(400).json({ message: "ward_name required" });

  const r = await pool.query(
    `UPDATE wards
     SET ward_name=$1, bed_count=$2, cot_count=$3, icu_count=$4, updated_at=NOW()
     WHERE id=$5
     RETURNING *`,
    [ward_name.trim(), Number(bed_count) || 0, Number(cot_count) || 0, Number(icu_count) || 0, id]
  );

  if (r.rowCount === 0) return res.status(404).json({ message: "Ward not found" });

  await logAudit({
    actor_id: req.user?.id,
    actor_email: req.user?.email,
    module: "HOSPITAL_ADMIN",
    action: "WARD_UPDATE",
    entity: "WARD",
    entity_id: id,
    detail: `Updated ward "${r.rows[0].ward_name}" (beds=${r.rows[0].bed_count}, cots=${r.rows[0].cot_count}, icu=${r.rows[0].icu_count})`,
    ip: req.ip,
  });

  res.json({ ward: r.rows[0] });
};

// GET /api/hospital-admin/diet-config
exports.getDietConfig = async (req, res) => {
  const r = await pool.query("SELECT active_diets, active_cycles, updated_at FROM diet_config WHERE id=1");
  res.json({ config: r.rows[0] || { active_diets: {}, active_cycles: {} } });
};

// POST /api/hospital-admin/diet-config
exports.saveDietConfig = async (req, res) => {
  const { active_diets = {}, active_cycles = {} } = req.body;

  const r = await pool.query(
    `UPDATE diet_config
     SET active_diets=$1, active_cycles=$2, updated_at=NOW()
     WHERE id=1
     RETURNING active_diets, active_cycles, updated_at`,
    [active_diets, active_cycles]
  );

  await logAudit({
    actor_id: req.user?.id,
    actor_email: req.user?.email,
    module: "HOSPITAL_ADMIN",
    action: "DIET_CONFIG_SAVE",
    entity: "DIET_CONFIG",
    detail: `Updated diet config`,
    ip: req.ip,
  });

  res.json({ config: r.rows[0] });
};

// GET /api/hospital-admin/ingredients
exports.getIngredients = async (req, res) => {
  const r = await pool.query("SELECT * FROM ingredients ORDER BY name ASC");
  res.json({ ingredients: r.rows });
};

// POST /api/hospital-admin/ingredients
exports.addIngredient = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name required" });

  const r = await pool.query(
    `INSERT INTO ingredients (name)
     VALUES ($1)
     RETURNING *`,
    [name.trim()]
  );

  await logAudit({
    actor_id: req.user?.id,
    actor_email: req.user?.email,
    module: "HOSPITAL_ADMIN",
    action: "INGREDIENT_CREATE",
    entity: "INGREDIENT",
    entity_id: r.rows[0].id,
    detail: `Added ingredient "${r.rows[0].name}"`,
    ip: req.ip,
  });

  res.status(201).json({ ingredient: r.rows[0] });
};

// GET /api/hospital-admin/norm-weights
exports.getNormWeights = async (req, res) => {
  const diet = (req.query.diet || "").trim();
  if (!diet) return res.status(400).json({ message: "diet query param required" });

  const r = await pool.query(
    `SELECT id, ingredient_id, diet, meal, grams, updated_at
     FROM norm_weights
     WHERE diet=$1
     ORDER BY ingredient_id ASC, meal ASC`,
    [diet]
  );
  res.json({ norms: r.rows });
};

// POST /api/hospital-admin/norm-weights
exports.saveNormWeights = async (req, res) => {
  const { norms = [] } = req.body;
  if (!Array.isArray(norms)) return res.status(400).json({ message: "norms must be array" });

  // Determine diet (all norms should be same diet)
  const diet = norms[0]?.diet;
  if (!diet) return res.status(400).json({ message: "diet missing in payload" });

  await pool.query("BEGIN");
  try {
    // delete existing for that diet, then insert fresh
    await pool.query("DELETE FROM norm_weights WHERE diet=$1", [diet]);

    for (const n of norms) {
      const ingredient_id = Number(n.ingredient_id);
      const meal = n.meal;
      const grams = Number(n.grams);

      if (!ingredient_id || !meal || Number.isNaN(grams)) continue;

      await pool.query(
        `INSERT INTO norm_weights (ingredient_id, diet, meal, grams, updated_at)
         VALUES ($1,$2,$3,$4,NOW())`,
        [ingredient_id, diet, meal, grams]
      );
    }

    await pool.query("COMMIT");

    await logAudit({
      actor_id: req.user?.id,
      actor_email: req.user?.email,
      module: "HOSPITAL_ADMIN",
      action: "NORM_WEIGHTS_SAVE",
      entity: "NORM_WEIGHTS",
      detail: `Saved ${norms.length} norms for diet "${diet}"`,
      ip: req.ip,
    });

    res.json({ message: "Saved", count: norms.length, diet });
  } catch (e) {
    await pool.query("ROLLBACK");
    res.status(500).json({ message: "Save failed", error: e.message });
  }
};

// GET /api/hospital-admin/fractional-formulas
exports.getFractionalFormulas = async (req, res) => {
  const r = await pool.query("SELECT * FROM fractional_formulas ORDER BY ingredient ASC");
  res.json({ formulas: r.rows });
};

// POST /api/hospital-admin/fractional-formulas
exports.createFractionalFormula = async (req, res) => {
  const { ingredient, fractions = {} } = req.body;
  if (!ingredient?.trim()) return res.status(400).json({ message: "ingredient required" });

  const r = await pool.query(
    `INSERT INTO fractional_formulas (ingredient, fractions, updated_at)
     VALUES ($1,$2,NOW())
     RETURNING *`,
    [ingredient.trim(), fractions]
  );

  await logAudit({
    actor_id: req.user?.id,
    actor_email: req.user?.email,
    module: "HOSPITAL_ADMIN",
    action: "FRACTIONAL_CREATE",
    entity: "FRACTIONAL_FORMULA",
    entity_id: r.rows[0].id,
    detail: `Created fractional formula for "${r.rows[0].ingredient}"`,
    ip: req.ip,
  });

  res.status(201).json({ formula: r.rows[0] });
};

// PUT /api/hospital-admin/fractional-formulas/:id
exports.updateFractionalFormula = async (req, res) => {
  const id = Number(req.params.id);
  const { ingredient, fractions = {} } = req.body;

  const r = await pool.query(
    `UPDATE fractional_formulas
     SET ingredient=$1, fractions=$2, updated_at=NOW()
     WHERE id=$3
     RETURNING *`,
    [ingredient?.trim(), fractions, id]
  );

  if (r.rowCount === 0) return res.status(404).json({ message: "Formula not found" });

  await logAudit({
    actor_id: req.user?.id,
    actor_email: req.user?.email,
    module: "HOSPITAL_ADMIN",
    action: "FRACTIONAL_UPDATE",
    entity: "FRACTIONAL_FORMULA",
    entity_id: id,
    detail: `Updated fractional formula for "${r.rows[0].ingredient}"`,
    ip: req.ip,
  });

  res.json({ formula: r.rows[0] });
};

// DELETE /api/hospital-admin/fractional-formulas/:id
exports.getCategories = async (req, res) => {
  const r = await pool.query("SELECT * FROM categories ORDER BY name ASC");
  res.json({ categories: r.rows });
};

exports.createCategory = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name required" });

  const r = await pool.query(
    `INSERT INTO categories (name, updated_at)
     VALUES ($1,NOW())
     RETURNING *`,
    [name.trim()]
  );

  await logAudit({
    actor_id: req.user?.id,
    actor_email: req.user?.email,
    module: "HOSPITAL_ADMIN",
    action: "CATEGORY_CREATE",
    entity: "CATEGORY",
    entity_id: r.rows[0].id,
    detail: `Created category "${r.rows[0].name}"`,
    ip: req.ip,
  });

  res.status(201).json({ category: r.rows[0] });
};

// PUT /api/hospital-admin/categories/:id
exports.updateCategory = async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body;

  const r = await pool.query(
    `UPDATE categories
     SET name=$1, updated_at=NOW()
     WHERE id=$2
     RETURNING *`,
    [name?.trim(), id]
  );

  if (r.rowCount === 0) return res.status(404).json({ message: "Category not found" });

  await logAudit({
    actor_id: req.user?.id,
    actor_email: req.user?.email,
    module: "HOSPITAL_ADMIN",
    action: "CATEGORY_UPDATE",
    entity: "CATEGORY",
    entity_id: id,
    detail: `Updated category to "${r.rows[0].name}"`,
    ip: req.ip,
  });

  res.json({ category: r.rows[0] });
};