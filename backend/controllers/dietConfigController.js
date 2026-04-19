  // controllers/dietConfigController.js
  const pool = require("../config/db");
  const { writeAudit } = require("../utils/audit");

  // GET /api/diet-config
  exports.getDietConfig = async (req, res) => {
    const r = await pool.query(`SELECT id, active_diets, active_cycles FROM diet_config WHERE id=1`);
    if (r.rowCount === 0) {
      return res.json({ config: { active_diets: {}, active_cycles: {} } });
    }
    res.json({ config: r.rows[0] });
  };

  // POST /api/diet-config
  exports.saveDietConfig = async (req, res) => {
    const { active_diets = {}, active_cycles = {} } = req.body;

    const r = await pool.query(
      `INSERT INTO diet_config (id, active_diets, active_cycles)
      VALUES (1, $1::jsonb, $2::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET active_diets=EXCLUDED.active_diets, active_cycles=EXCLUDED.active_cycles
      RETURNING id, active_diets, active_cycles`,
      [JSON.stringify(active_diets), JSON.stringify(active_cycles)]
    );

    await writeAudit({
      req,
      action: "DIET_CONFIG_SAVE",
      entity: "DIET_CONFIG",
      entity_id: 1,
      actor_user_id: req.user?.id,
      actor_email: req.user?.email,
      actor_role: req.user?.role,
      details: r.rows[0],
    });

    res.json({ config: r.rows[0] });
  };