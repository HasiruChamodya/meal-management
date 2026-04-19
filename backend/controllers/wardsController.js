const wardModel = require("../models/wardModel");
const { writeAudit } = require("../utils/audit");

// GET /api/wards
exports.getWards = async (req, res) => {
  try {
    const wards = await wardModel.getAllWards();

    await writeAudit({
      req,
      action: "GET_WARDS",
      entity: "wards",
      details: { count: wards.length },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({ wards });
  } catch (error) {
    console.error("GET WARDS ERROR:", error);

    await writeAudit({
      req,
      action: "GET_WARDS",
      entity: "wards",
      details: { error: error.message },
      severity: "security",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to fetch wards" });
  }
};

// POST /api/wards
exports.createWard = async (req, res) => {
  try {
    const { code, name, beds = 0, cots = 0, icu = 0, incubators = 0 } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        message: "code and name are required",
      });
    }

    const newWard = await wardModel.createWard({
      code,
      name,
      beds,
      cots,
      icu,
      incubators,
    });

    await writeAudit({
      req,
      action: "CREATE_WARD",
      entity: "wards",
      entity_id: String(newWard.id),
      new_value: newWard,
      details: { message: "Ward created successfully" },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({
      message: "Ward created successfully",
      ward: newWard,
    });
  } catch (error) {
    console.error("CREATE WARD ERROR:", error);

    await writeAudit({
      req,
      action: "CREATE_WARD",
      entity: "wards",
      details: { error: error.message },
      severity: "security",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to create ward" });
  }
};

// PUT /api/wards/:id
exports.updateWard = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, beds = 0, cots = 0, icu = 0, incubators = 0 } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        message: "code and name are required",
      });
    }

    const oldWard = await wardModel.getWardById(id);

    if (!oldWard) {
      return res.status(404).json({ message: "Ward not found" });
    }

    const updatedWard = await wardModel.updateWard(id, {
      code,
      name,
      beds,
      cots,
      icu,
      incubators,
    });

    await writeAudit({
      req,
      action: "UPDATE_WARD",
      entity: "wards",
      entity_id: String(id),
      old_value: oldWard,
      new_value: updatedWard,
      details: { message: "Ward updated successfully" },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({
      message: "Ward updated successfully",
      ward: updatedWard,
    });
  } catch (error) {
    console.error("UPDATE WARD ERROR:", error);

    await writeAudit({
      req,
      action: "UPDATE_WARD",
      entity: "wards",
      entity_id: String(req.params?.id),
      details: { error: error.message },
      severity: "security",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to update ward" });
  }
};

// PUT /api/wards/:id/status
exports.toggleWardStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== "boolean") {
      return res.status(400).json({
        message: "active must be true or false",
      });
    }

    const oldWard = await wardModel.getWardById(id);

    if (!oldWard) {
      return res.status(404).json({ message: "Ward not found" });
    }

    const updatedWard = await wardModel.updateWardStatus(id, active);

    await writeAudit({
      req,
      action: "CHANGE_WARD_STATUS",
      entity: "wards",
      entity_id: String(id),
      old_value: { active: oldWard.active },
      new_value: { active: updatedWard.active },
      details: { message: "Ward status changed" },
      severity: "security",
      status_code: 200,
      success: true,
    });

    res.status(200).json({
      message: "Ward status updated successfully",
      ward: updatedWard,
    });
  } catch (error) {
    console.error("CHANGE WARD STATUS ERROR:", error);

    await writeAudit({
      req,
      action: "CHANGE_WARD_STATUS",
      entity: "wards",
      entity_id: String(req.params?.id),
      details: { error: error.message },
      severity: "security",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to update ward status" });
  }
};