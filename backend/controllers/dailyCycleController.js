const dailyCycleModel = require("../models/dailyCycleModel");
const { writeAudit } = require("../utils/audit");

// Helper to get today's date in Sri Lanka timezone (YYYY-MM-DD)
const getTodaySL = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });

// GET /api/daily-cycle?date=YYYY-MM-DD
exports.getDailyCycle = async (req, res) => {
  try {
    // Default to today if no date is provided
    const requestedDate = req.query.date || getTodaySL();
    
    const cycle = await dailyCycleModel.getCycleForDate(requestedDate);

    // If somehow the table is totally empty, return a safe fallback
    if (!cycle) {
      return res.status(200).json({
        cycle: { patientCycle: "Vegetable", staffCycle: "Chicken", date: requestedDate }
      });
    }

    res.status(200).json({ cycle });
  } catch (error) {
    console.error("GET DAILY CYCLE ERROR:", error);
    res.status(500).json({ message: "Failed to fetch daily cycle" });
  }
};

// POST /api/daily-cycle
exports.setDailyCycle = async (req, res) => {
  try {
    const { date, patientCycle, staffCycle } = req.body;

    if (!date || !patientCycle || !staffCycle) {
      return res.status(400).json({ message: "Date, patientCycle, and staffCycle are required" });
    }

    const oldCycle = await dailyCycleModel.getCycleForDate(date);
    const newCycle = await dailyCycleModel.upsertCycle(date, patientCycle, staffCycle);

    await writeAudit({
      req,
      action: "UPDATE_DAILY_CYCLE",
      entity: "daily_meal_cycles",
      entity_id: date,
      old_value: oldCycle,
      new_value: newCycle,
      details: { message: `Diet cycle applied starting ${date}` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({
      message: "Daily meal cycle saved successfully",
      cycle: newCycle,
    });
  } 
  // Catch any unexpected errors and log them in the audit trail with severity "error"
  catch (error) {
    console.error("SET DAILY CYCLE ERROR:", error);

    await writeAudit({
      req,
      action: "UPDATE_DAILY_CYCLE",
      entity: "daily_meal_cycles",
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to save daily cycle" });
  }
};