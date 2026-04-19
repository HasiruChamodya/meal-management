const dietTypesModel = require("../models/dietTypesModel");
const { writeAudit } = require("../utils/audit");

// GET /api/diet-types
exports.getDietTypes = async (req, res) => {
  try {
    const dietTypes = await dietTypesModel.getAllDietTypes();
    res.status(200).json({ dietTypes });
  } catch (error) {
    console.error("GET DIET TYPES ERROR:", error);
    res.status(500).json({ message: "Failed to fetch diet types" });
  }
};

// POST /api/diet-types
exports.createDietType = async (req, res) => {
  try {
    const {
      code,
      nameEn,
      nameSi,
      ageRange = "All",
      type = "Patient",
      displayOrder = 1,
      active = true,
    } = req.body;

    if (!code || !nameEn || !nameSi) {
      return res.status(400).json({
        message: "code, nameEn and nameSi are required",
      });
    }

    const dietType = await dietTypesModel.createDietType({
      code,
      nameEn,
      nameSi,
      ageRange,
      type,
      displayOrder,
      active,
    });

    await writeAudit({
      req,
      action: "CREATE_DIET_TYPE",
      entity: "diet_types",
      entity_id: String(dietType.id),
      new_value: dietType,
      details: { message: "Diet type created successfully" },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({
      message: "Diet type created successfully",
      dietType,
    });
  } catch (error) {
    console.error("CREATE DIET TYPE ERROR:", error);

    if (error.code === "23505") {
      return res.status(409).json({ message: "Diet type code already exists" });
    }

    res.status(500).json({ message: "Failed to create diet type" });
  }
};

// PUT /api/diet-types/:id
exports.updateDietType = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      nameEn,
      nameSi,
      ageRange = "All",
      type = "Patient",
      displayOrder = 1,
      active = true,
    } = req.body;

    if (!code || !nameEn || !nameSi) {
      return res.status(400).json({
        message: "code, nameEn and nameSi are required",
      });
    }

    const oldDietType = await dietTypesModel.getDietTypeById(id);
    if (!oldDietType) {
      return res.status(404).json({ message: "Diet type not found" });
    }

    const dietType = await dietTypesModel.updateDietType(id, {
      code,
      nameEn,
      nameSi,
      ageRange,
      type,
      displayOrder,
      active,
    });

    await writeAudit({
      req,
      action: "UPDATE_DIET_TYPE",
      entity: "diet_types",
      entity_id: String(id),
      old_value: oldDietType,
      new_value: dietType,
      details: { message: "Diet type updated successfully" },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({
      message: "Diet type updated successfully",
      dietType,
    });
  } catch (error) {
    console.error("UPDATE DIET TYPE ERROR:", error);

    if (error.code === "23505") {
      return res.status(409).json({ message: "Diet type code already exists" });
    }

    res.status(500).json({ message: "Failed to update diet type" });
  }
};

// PATCH /api/diet-types/:id/status
exports.toggleDietTypeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== "boolean") {
      return res.status(400).json({ message: "active must be true or false" });
    }

    const oldDietType = await dietTypesModel.getDietTypeById(id);
    if (!oldDietType) {
      return res.status(404).json({ message: "Diet type not found" });
    }

    const dietType = await dietTypesModel.updateDietTypeStatus(id, active);

    await writeAudit({
      req,
      action: "CHANGE_DIET_TYPE_STATUS",
      entity: "diet_types",
      entity_id: String(id),
      old_value: { active: oldDietType.active },
      new_value: { active: dietType.active },
      details: { message: "Diet type status updated successfully" },
      severity: "security",
      status_code: 200,
      success: true,
    });

    res.status(200).json({
      message: "Diet type status updated successfully",
      dietType,
    });
  } catch (error) {
    console.error("CHANGE DIET TYPE STATUS ERROR:", error);
    res.status(500).json({ message: "Failed to update diet type status" });
  }
};