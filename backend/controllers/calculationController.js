const calculationModel = require("../models/calculationModel");
const { writeAudit } = require("../utils/audit");
const { getBaseUnit, toDisplayUnit, roundDisplay } = require("../utils/uom");
const pool = require("../config/db");

// Helper functions to build cook sheet sections
exports.runCalculation = async (req, res) => {
  // This endpoint triggers the calculation for a given date. It also logs the action in the audit trail with details about the calculation run.
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ message: "date is required" });

    const result = await calculationModel.runCalculation(date, req.user?.id);
    
    // Log the calculation run in the audit trail with relevant details for monitoring and debugging
    await writeAudit({
      req, action: "RUN_CALCULATION", entity: "calculation_runs",
      entity_id: String(result.calcRunId),
      new_value: { date, patientCycle: result.patientCycle, staffCycle: result.staffCycle,
        totalItems: result.grandTotals.length, totalRecipes: result.recipeResults.length },
      details: { message: `Calculation completed for ${date}` },
      severity: "info", status_code: 200, success: true,
    });

    res.status(200).json({
      message: "Calculation completed successfully",
      calcRunId: result.calcRunId, date: result.date,
      patientCycle: result.patientCycle, staffCycle: result.staffCycle,
      aggregated: result.aggregated,
    });
  } 
  // Catch any errors that occur during the calculation process, log them in the audit trail with error severity, and return a generic error message to the client
  catch (error) {
    console.error("RUN CALCULATION ERROR:", error);
    await writeAudit({
      req, action: "RUN_CALCULATION", entity: "calculation_runs",
      details: { error: error.message, date: req.body?.date },
      severity: "error", status_code: 500, success: false,
    });
    res.status(500).json({ message: error.message || "Calculation failed" });
  }
};

// This controller handles fetching calculation results, cook sheets, and item breakdowns for a given date. It also includes helper functions to group results for frontend display and build specific sections of the cook sheet based on the calculation results.
exports.getResults = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date is required" });

    const results = await calculationModel.getCalculationResults(date);
    if (!results) return res.status(404).json({ message: "No calculation results found for this date" });

    const catResult = await pool.query(`SELECT id, name FROM categories ORDER BY id ASC`); // Fetch categories to maintain consistent ordering and names for frontend tabs, instead of relying on category names from line items which may be inconsistent. This also allows us to return empty tabs for categories that had no items in the calculation, preserving the full category structure in the frontend.
    const categories = catResult.rows; // [{id: 1, name: "Rice"}, {id: 2, name: "Vegetables"}, ...] in DB order
    const grouped = groupResultsForFrontend(results, categories); // Group line items into tabs based on their category_id, using the database categories for consistent tab structure. Items with missing or unmatched category_id will be grouped into an "Extras & Specials" tab. This function also calculates grand totals and prepares the data for frontend display without hardcoding any category names or IDs.

    res.status(200).json({
      run: results.run,
      tabs: grouped.tabs,
      categories: grouped.categories,
      vegSummaries: results.vegSummaries,
      recipeResults: results.recipeResults,
      poLineItems: results.poLineItems,
    });
  } 
  // Catch any errors that occur during the calculation process, log them in the audit trail with error severity, and return a generic error message to the client
  catch (error) {
    console.error("GET CALC RESULTS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch calculation results" });
  }
};

// This controller also includes an endpoint to fetch the daily history of calculation runs, which can be used to display a history table in the frontend with details about each run, such as date, patient cycle, staff cycle, total items, and total recipes. This allows users to track past calculations and their outcomes.
exports.getCookSheet = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date is required" });

    const results = await calculationModel.getCalculationResults(date);
    if (!results) return res.status(404).json({ message: "No calculation results found for this date" });

    const cookSheet = {
      date: results.run.date,
      patientCycle: results.run.patientCycle,
      staffCycle: results.run.staffCycle,
      patientTotals: results.run.patientTotals,
      staff: {
        breakfast: results.run.staffBreakfast,
        lunch: results.run.staffLunch,
        dinner: results.run.staffDinner,
      },
      dietInstructions: buildDietInstructions(results.lineItems),
      proteinAllocation: buildProteinAllocation(results.lineItems),
      recipes: results.recipeResults,
      kanda: results.run.kandaCount > 0
        ? { count: results.run.kandaCount, redRiceG: results.run.kandaCount * 30 }
        : null,
      extras: results.run.extrasTotals,
      customExtras: results.run.customExtrasTotals,
    };

    res.status(200).json({ cookSheet });
  } catch (error) {
    console.error("GET COOK SHEET ERROR:", error);
    res.status(500).json({ message: "Failed to fetch cook sheet" });
  }
};

// This endpoint provides a detailed breakdown of how the total quantity for a specific item in the calculation was derived, showing the contribution from each meal and diet type. This allows users to understand the composition of the item's total and identify which meals and diet types are driving the demand for that item.
exports.getItemBreakdown = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { date } = req.query;
    if (!date || !itemId) return res.status(400).json({ message: "date and itemId are required" });

    const results = await calculationModel.getCalculationResults(date);
    if (!results) return res.status(404).json({ message: "No calculation results found" });

    const itemLines = results.lineItems.filter((li) => li.itemId === Number(itemId));
    if (itemLines.length === 0) return res.status(404).json({ message: "Item not found in calculation" });

    const breakdown = {};
    for (const li of itemLines) {
      for (const [code, data] of Object.entries(li.breakdown)) {
        if (!breakdown[code]) {
          breakdown[code] = { dietType: data.nameEn || code, code, meals: {}, totalG: 0 };
        }
        breakdown[code].meals[li.meal] = { count: data.count, normG: data.normG, subtotalG: data.totalG };
        breakdown[code].totalG += data.totalG;
      }
    }

    res.status(200).json({
      itemId: Number(itemId),
      nameEn: itemLines[0].nameEn, nameSi: itemLines[0].nameSi, unit: itemLines[0].unit,
      meals: itemLines.map((li) => ({ meal: li.meal, displayValue: li.displayValue, displayUnit: li.displayUnit })),
      breakdown: Object.values(breakdown),
    });
  } catch (error) {
    console.error("GET BREAKDOWN ERROR:", error);
    res.status(500).json({ message: "Failed to fetch item breakdown" });
  }
};

// Special tab key for raw-sum extras that don't correspond to a DB category
const EXTRAS_TAB_KEY = 'extras';

function groupResultsForFrontend(results, categories) {
  const itemMap = {};
  for (const li of results.lineItems) {
    if (!itemMap[li.itemId]) {
      itemMap[li.itemId] = {
        id: li.itemId,
        nameEn: li.nameEn,
        nameSi: li.nameSi,
        unit: li.unit,
        categoryId: li.categoryId,
        categoryName: li.categoryName,
        breakfast: null, lunch: null, dinner: null,
        grandTotal: 0, grandTotalBase: 0, breakdown: [],
      };
    }
    const item = itemMap[li.itemId];
    item[li.meal] = li.displayValue;
    item.grandTotalBase += li.subtotalBase;

    for (const [code, data] of Object.entries(li.breakdown)) {
      item.breakdown.push({
        meal: li.meal, dietType: data.nameEn || code, code,
        count: data.count, normG: data.normG, subtotalG: data.totalG,
      });
    }
  }

  for (const item of Object.values(itemMap)) {
    item.grandTotal = roundDisplay(toDisplayUnit(item.grandTotalBase, item.unit), item.unit);
  }

  // Build tabs object keyed by category ID (string) using database categories
  const tabs = {};
  for (const cat of categories) {
    tabs[String(cat.id)] = [];
  }
  tabs[EXTRAS_TAB_KEY] = [];

  // Group items by category_id from the database — no hardcoded flags
  for (const item of Object.values(itemMap)) {
    const catId = String(item.categoryId);
    if (catId && tabs[catId] !== undefined) {
      tabs[catId].push(item);
    } else {
      tabs[EXTRAS_TAB_KEY].push(item);
    }
  }

  // Add raw-sum extras (census extra items) to the extras tab
  const extrasTotals = results.run.extrasTotals || {};
  for (const [name, qty] of Object.entries(extrasTotals)) {
    if (Number(qty) > 0) {
      tabs[EXTRAS_TAB_KEY].push({
        id: `extra-${name}`, nameEn: name, nameSi: "", unit: "",
        breakfast: null, lunch: null, dinner: null,
        grandTotal: Number(qty), isExtra: true, breakdown: [],
      });
    }
  }

  // Return only populated category tabs, preserving DB order
  const activeCategories = categories
    .filter((cat) => tabs[String(cat.id)]?.length > 0)
    .map((cat) => ({ id: String(cat.id), name: cat.name }));

  if (tabs[EXTRAS_TAB_KEY].length > 0) {
    activeCategories.push({ id: EXTRAS_TAB_KEY, name: 'Extras & Specials' });
  }

  return { tabs, categories: activeCategories };
}

// Helper function to build the diet instructions section of the cook sheet based on the line items from the calculation results. It aggregates rice and bread items separately for each meal to provide clear instructions on how much rice and bread to prepare for breakfast, lunch, and dinner.
function buildDietInstructions(lineItems) {
  const instructions = [];

  const riceItems = lineItems.filter((li) => {
    const catId = Number(li.categoryId) || 0;
    return catId === 1 && !li.nameEn?.toLowerCase().includes("bread");
  });
  const breadItems = lineItems.filter((li) => li.nameEn?.toLowerCase().includes("bread"));

  const riceMeals = { breakfast: 0, lunch: 0, dinner: 0 };
  for (const li of riceItems) {
    riceMeals[li.meal] = (riceMeals[li.meal] || 0) + li.displayValue;
  }
  instructions.push({
    type: "Rice (Kg)",
    breakfast: Math.round(riceMeals.breakfast * 100) / 100 || null,
    lunch: Math.round(riceMeals.lunch * 100) / 100 || null,
    dinner: Math.round(riceMeals.dinner * 100) / 100 || null,
  });

  const breadMeals = { breakfast: 0, lunch: 0, dinner: 0 };
  for (const li of breadItems) {
    breadMeals[li.meal] = (breadMeals[li.meal] || 0) + li.displayValue;
  }
  instructions.push({
    type: "Bread (loaves)",
    breakfast: breadMeals.breakfast || null,
    lunch: breadMeals.lunch || null,
    dinner: breadMeals.dinner || null,
  });

  return instructions;
}

// Helper function to build the protein allocation section of the cook sheet based on the line items from the calculation results. It identifies which items are proteins, then aggregates the total quantity for each protein item by meal and diet type (patients vs staff) to provide a clear allocation of how much of each protein item is needed for patients and staff across breakfast, lunch, and dinner.
function buildProteinAllocation(lineItems) {
  const proteinItems = lineItems.filter((li) => !!li.isProtein);
  const allocation = {};

  for (const li of proteinItems) {
    if (!allocation[li.itemId]) {
      allocation[li.itemId] = { nameEn: li.nameEn, nameSi: li.nameSi, unit: li.unit, children: 0, patients: 0, staff: 0 };
    }
    const a = allocation[li.itemId];
    const bd = li.breakdown || {};
    for (const [code, data] of Object.entries(bd)) {
      const totalKg = data.totalG / 1000;
      if (code === "STAFF") a.staff += totalKg;
      else if (["S1", "S2", "S3", "S4", "S5"].includes(code)) a.children += totalKg;
      else a.patients += totalKg;
    }
  }

  return Object.values(allocation).map((a) => ({
    ...a,
    children: Math.round(a.children * 100) / 100,
    patients: Math.round(a.patients * 100) / 100,
    staff: Math.round(a.staff * 100) / 100,
  }));
}


exports.getCookSheet = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date is required" });

    const results = await calculationModel.getCalculationResults(date);
    if (!results) return res.status(404).json({ message: "No calculation results found for this date" });

    const cookSheet = {
      date: results.run.date,
      patientCycle: results.run.patientCycle,
      staffCycle: results.run.staffCycle,
      patientTotals: results.run.patientTotals, // <-- This brings the counts back!
      staff: {
        breakfast: results.run.staffBreakfast,
        lunch: results.run.staffLunch,
        dinner: results.run.staffDinner,
      },
      dietInstructions: buildDietInstructions(results.lineItems),
      proteinAllocation: buildProteinAllocation(results.lineItems),
      recipes: results.recipeResults,
      kanda: results.run.kandaCount > 0
        ? { count: results.run.kandaCount, redRiceG: results.run.kandaCount * 30 }
        : null,
      extras: results.run.extrasTotals,
      customExtras: results.run.customExtrasTotals,
    };

    res.status(200).json({ cookSheet });
  } catch (error) {
    console.error("GET COOK SHEET ERROR:", error);
    res.status(500).json({ message: "Failed to fetch cook sheet" });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const history = await calculationModel.getDailyHistory();
    res.status(200).json({ history });
  } catch (error) {
    console.error("GET HISTORY ERROR:", error);
    res.status(500).json({ message: "Failed to fetch daily history" });
  }
};