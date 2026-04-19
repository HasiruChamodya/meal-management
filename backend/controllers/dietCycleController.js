const dietCycleModel = require("../models/dietCycleModel");
const { writeAudit } = require("../utils/audit");

// GET /api/diet-cycles
exports.getDietCycles = async (req, res) => {
  try {
    const cycles = await dietCycleModel.getAllDietCycles();

    await writeAudit({
      req,
      action: "GET_DIET_CYCLES",
      entity: "diet_cycles",
      details: { count: cycles.length },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({ cycles });
  } 
  // Catch any unexpected errors and log them in the audit trail with severity "error"
  catch (error) {
    console.error("GET DIET CYCLES ERROR:", error);

    await writeAudit({
      req,
      action: "GET_DIET_CYCLES",
      entity: "diet_cycles",
      details: { error: error.message },
      severity: "warning",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to fetch diet cycles" });
  }
};

// POST /api/diet-cycles
exports.createDietCycle = async (req, res) => {
  try {
    const { code, nameEn, nameSi, active } = req.body;

    if (!code || !nameEn) {
      await writeAudit({
        req,
        action: "CREATE_DIET_CYCLE",
        entity: "diet_cycles",
        details: { error: "Code and English Name are required" },
        severity: "warning",
        status_code: 400,
        success: false,
      });

      return res.status(400).json({ message: "Code and English Name are required" });
    }
    // Check for duplicate code before attempting to create the diet cycle
    const newCycle = await dietCycleModel.createDietCycle({
      code, nameEn, nameSi, active
    });

    await writeAudit({
      req,
      action: "CREATE_DIET_CYCLE",
      entity: "diet_cycles",
      entity_id: String(newCycle.id),
      new_value: newCycle,
      details: { message: "Diet cycle created successfully" },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({
      message: "Diet cycle created successfully",
      cycle: newCycle,
    });
  } 
  // Catch any unexpected errors and log them in the audit trail with severity "error"
  catch (error) {
    console.error("CREATE DIET CYCLE ERROR:", error);

    await writeAudit({
      req,
      action: "CREATE_DIET_CYCLE",
      entity: "diet_cycles",
      details: { error: error.message, code: req.body?.code || null },
      severity: "error",
      status_code: error.code === "23505" ? 409 : 500,
      success: false,
    });

    if (error.code === "23505") {
      return res.status(409).json({ message: "Diet cycle code already exists" });
    }

    res.status(500).json({ message: "Failed to create diet cycle" });
  }
};

// PUT /api/diet-cycles/:id
exports.updateDietCycle = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, nameEn, nameSi, active } = req.body;

    if (!code || !nameEn) {
      return res.status(400).json({ message: "Code and English Name are required" });
    }

    const oldCycle = await dietCycleModel.getDietCycleById(id);

    if (!oldCycle) {
      return res.status(404).json({ message: "Diet cycle not found" });
    }

    const updatedCycle = await dietCycleModel.updateDietCycle(id, {
      code, nameEn, nameSi, active
    });

    await writeAudit({
      req,
      action: "UPDATE_DIET_CYCLE",
      entity: "diet_cycles",
      entity_id: String(id),
      old_value: oldCycle,
      new_value: updatedCycle,
      details: { message: "Diet cycle updated successfully" },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({
      message: "Diet cycle updated successfully",
      cycle: updatedCycle,
    });
  } 
  // Catch any unexpected errors and log them in the audit trail with severity "error"
  catch (error) {
    console.error("UPDATE DIET CYCLE ERROR:", error);

    await writeAudit({
      req,
      action: "UPDATE_DIET_CYCLE",
      entity: "diet_cycles",
      entity_id: String(req.params?.id),
      details: { error: error.message },
      severity: "error",
      status_code: error.code === "23505" ? 409 : 500,
      success: false,
    });

    if (error.code === "23505") {
      return res.status(409).json({ message: "Diet cycle code already exists" });
    }

    res.status(500).json({ message: "Failed to update diet cycle" });
  }
};

// PATCH /api/diet-cycles/:id/status
exports.toggleDietCycleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ message: "Active status must be a boolean" });
    }

    const oldCycle = await dietCycleModel.getDietCycleById(id);

    if (!oldCycle) {
      return res.status(404).json({ message: "Diet cycle not found" });
    }

    const updatedCycle = await dietCycleModel.toggleDietCycleStatus(id, active);

    await writeAudit({
      req,
      action: "CHANGE_DIET_CYCLE_STATUS",
      entity: "diet_cycles",
      entity_id: String(id),
      old_value: { active: oldCycle.active },
      new_value: { active: updatedCycle.active },
      details: { message: `Diet cycle status changed to ${active ? 'Active' : 'Inactive'}` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({
      message: "Diet cycle status updated successfully",
      cycle: updatedCycle,
    });
  } catch (error) {
    console.error("TOGGLE DIET CYCLE STATUS ERROR:", error);

    await writeAudit({
      req,
      action: "CHANGE_DIET_CYCLE_STATUS",
      entity: "diet_cycles",
      entity_id: String(req.params?.id),
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to update diet cycle status" });
  }
};