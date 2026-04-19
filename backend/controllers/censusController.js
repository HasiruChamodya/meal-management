const censusModel = require("../models/censusModel");
const { writeAudit } = require("../utils/audit");

// Helper to get today's date in Sri Lanka timezone (YYYY-MM-DD)
const getTodaySL = () => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
};

// This controller manages all census-related operations, including fetching ward census data, saving drafts, submitting final census entries, and handling staff meal counts. It ensures that only authorized edits are allowed (e.g., only for the current day and if not locked) and logs all significant actions in the audit trail for accountability and traceability.
exports.getWardCensus = async (req, res) => {
  try {
    const { wardId } = req.params;
    const { date } = req.query;

    if (!wardId || !date) {
      return res.status(400).json({ message: "wardId and date are required" });
    }

    const census = await censusModel.getWardCensusByDate(wardId, date);
    res.status(200).json({ census });
  } catch (error) {
    console.error("GET WARD CENSUS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch ward census" });
  }
};

// This endpoint retrieves the census status for all wards on a specific date, allowing users to see which wards have submitted their census data, which are still in draft, and which (if any) are locked. This provides a comprehensive overview of the census submission status across the hospital for that day.
exports.getWardStatuses = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date is required" });

    const statuses = await censusModel.getAllWardCensusStatusesByDate(date);
    res.status(200).json({ statuses });
  } catch (error) {
    console.error("GET CENSUS STATUSES ERROR:", error);
    res.status(500).json({ message: "Failed to fetch census statuses" });
  }
};

// This endpoint allows users to save a draft of the ward census data for the current day. It performs validation to ensure that only the current day's data can be edited and that locked records cannot be modified. The draft status allows users to save their progress without finalizing the submission, enabling them to return later to complete it.
exports.saveWardCensusDraft = async (req, res) => {
  try {
    const { wardId, date, diets = {}, special = {}, extras = {}, customExtras = [] } = req.body;

    if (!wardId || !date) return res.status(400).json({ message: "wardId and date are required" });

    // Security: Only allow edits for the current day
    if (date !== getTodaySL()) {
      return res.status(403).json({ message: "You can only edit records for the current day." });
    }

    // Security: Prevent editing if locked
    const existing = await censusModel.getWardCensusByDate(wardId, date);
    if (existing && existing.status === "locked") {
      return res.status(403).json({ message: "This record is locked and cannot be edited." });
    }

    const totalPatients = Object.values(diets).reduce((sum, value) => sum + (Number(value) || 0), 0);

    const census = await censusModel.upsertWardCensus({
      wardId, entryDate: date, status: "draft", totalPatients, diets, special, extras, customExtras,
    });

    await writeAudit({
      req, action: "SAVE_CENSUS_DRAFT", entity: "census_entries", entity_id: `${wardId}_${date}`,
      new_value: census, details: { wardId, date, totalPatients }, severity: "info", status_code: 200, success: true,
    });

    res.status(200).json({ message: "Census draft saved successfully", census });
  } catch (error) {
    console.error("SAVE CENSUS DRAFT ERROR:", error);
    res.status(500).json({ message: "Failed to save census draft" });
  }
};

//  This endpoint finalizes the submission of the ward census data for the current day. It performs the same validations as the draft-saving endpoint to ensure that only valid submissions are accepted. Once submitted, the census entry is marked as "submitted" and can no longer be edited unless an admin unlocks it. This ensures that the submitted data is stable and can be used for meal calculations without risk of last-minute changes.
exports.submitWardCensus = async (req, res) => {
  try {
    const { wardId, date, diets = {}, special = {}, extras = {}, customExtras = [] } = req.body;

    if (!wardId || !date) return res.status(400).json({ message: "wardId and date are required" });
    
    // Security: Only allow edits for the current day
    if (date !== getTodaySL()) {
      return res.status(403).json({ message: "You can only edit records for the current day." });
    }

    // Security: Prevent editing if locked
    const existing = await censusModel.getWardCensusByDate(wardId, date);
    if (existing && existing.status === "locked") {
      return res.status(403).json({ message: "This record is locked and cannot be edited." });
    }

    const totalPatients = Object.values(diets).reduce((sum, value) => sum + (Number(value) || 0), 0);

    const census = await censusModel.upsertWardCensus({
      wardId, entryDate: date, status: "submitted", totalPatients, diets, special, extras, customExtras,
      submittedBy: req.user?.id || null, submittedAt: new Date(),
    });

    await writeAudit({
      req, action: "SUBMIT_CENSUS", entity: "census_entries", entity_id: `${wardId}_${date}`,
      new_value: census, details: { wardId, date, totalPatients }, severity: "info", status_code: 200, success: true,
    });

    res.status(200).json({ message: "Ward census submitted successfully", census });
  } catch (error) {
    console.error("SUBMIT CENSUS ERROR:", error);
    res.status(500).json({ message: "Failed to submit ward census" });
  }
};

// This endpoint retrieves the staff meal counts for a specific date, allowing the kitchen to plan for the number of meals needed for staff in addition to patients. It provides a breakdown of breakfast, lunch, and dinner counts, as well as the staff meal cycle (e.g., Chicken, Fish, etc.) to ensure that the correct meals are prepared for staff members.
exports.getStaffMeals = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date is required" });

    const staffMeals = await censusModel.getStaffMealsByDate(date);
    res.status(200).json({ staffMeals });
  } catch (error) {
    console.error("GET STAFF MEALS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch staff meals" });
  }
};

// This endpoint allows users to submit the staff meal counts for the current day. It includes validation to ensure that only the current day's data can be edited and that locked records cannot be modified. The submitted staff meal counts are crucial for the kitchen to plan and prepare the appropriate number of meals for staff members, in addition to patient meals.
exports.submitStaffMeals = async (req, res) => {
  try {
    const { date, breakfast = 0, lunch = 0, dinner = 0, staffCycle = "Chicken" } = req.body;

    if (!date) return res.status(400).json({ message: "date is required" });

    // Security: Only allow edits for the current day
    if (date !== getTodaySL()) {
      return res.status(403).json({ message: "You can only edit records for the current day." });
    }

    // Security: Prevent editing if locked
    const existing = await censusModel.getStaffMealsByDate(date);
    if (existing && existing.status === "locked") {
      return res.status(403).json({ message: "Staff meals are locked and cannot be edited." });
    }

    const staffMeals = await censusModel.upsertStaffMeals({
      mealDate: date, breakfast, lunch, dinner, staffCycle, status: "submitted",
      submittedBy: req.user?.id || null, submittedAt: new Date(),
    });

    await writeAudit({
      req, action: "SUBMIT_STAFF_MEALS", entity: "staff_meals", entity_id: date,
      new_value: staffMeals, details: { date, breakfast, lunch, dinner }, severity: "info", status_code: 200, success: true,
    });

    res.status(200).json({ message: "Staff meals submitted successfully", staffMeals });
  } catch (error) {
    console.error("SUBMIT STAFF MEALS ERROR:", error);
    res.status(500).json({ message: "Failed to submit staff meals" });
  }
};

// This endpoint allows users to retrieve all their census submissions for a specific date, providing them with a history of their entries and the ability to review past submissions. This can be useful for tracking changes over time and ensuring that all census data is accurate and complete.
exports.getMySubmissions = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date is required" });

    const submissions = await censusModel.getSubmissionsByDate(date);
    res.status(200).json({ submissions });
  } catch (error) {
    console.error("GET MY SUBMISSIONS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch submissions" });
  }
};