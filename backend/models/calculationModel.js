
const pool = require("../config/db");
const { getBaseUnit, toDisplayUnit, roundDisplay } = require("../utils/uom");

// This module implements the core calculation logic for determining required quantities of each item
async function gatherInputs(calcDate) {
  // Get all submitted census entries for this date
  const censusRes = await pool.query(
    `SELECT * FROM census_entries WHERE entry_date = $1 AND status = 'submitted'`,
    [calcDate]
  );
  const censusRows = censusRes.rows;

  // Get staff meals for this date
  const staffRes = await pool.query(
    `SELECT * FROM staff_meals WHERE meal_date = $1 LIMIT 1`,
    [calcDate]
  );
  const staffRow = staffRes.rows[0] || null;

  // Get daily meal cycle
  const cycleRes = await pool.query(
    `SELECT * FROM daily_meal_cycles WHERE date <= $1 ORDER BY date DESC LIMIT 1`,
    [calcDate]
  );
  const cycleRow = cycleRes.rows[0] || { patient_cycle: "Vegetable", staff_cycle: "Chicken" };

  // Get all active diet types
  const dietTypesRes = await pool.query(
    `SELECT * FROM diet_types WHERE active = TRUE ORDER BY display_order ASC`
  );
  const dietTypes = dietTypesRes.rows;

  // Get all active items
  const itemsRes = await pool.query(
    `SELECT i.*, c.name as category_name FROM items i
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE i.active = TRUE ORDER BY i.id`
  );
  const items = itemsRes.rows;

  // Get ALL norm weights
  const weightsRes = await pool.query(`SELECT * FROM norm_weights`);
  const normWeights = weightsRes.rows;

  // Get recipes with ingredients
  const recipesRes = await pool.query(
    `SELECT * FROM recipes WHERE active = TRUE`
  );
  const recipes = recipesRes.rows;

  const recipeIngredientsRes = await pool.query(
    `SELECT ri.*, i.name_en, i.name_si, i.unit
     FROM recipe_ingredients ri
     JOIN items i ON i.id = ri.item_id
     ORDER BY ri.recipe_id, i.name_en`
  );
  const recipeIngredients = recipeIngredientsRes.rows;

  // Get recipe diet factors
  const factorsRes = await pool.query(`SELECT * FROM recipe_diet_factors`);
  const recipeDietFactors = factorsRes.rows;

  return {
    censusRows,
    staffRow,
    cycleRow,
    dietTypes,
    items,
    normWeights,
    recipes,
    recipeIngredients,
    recipeDietFactors,
  };
}


function aggregateWardData(censusRows, dietTypes) {
  // Sum patient counts per diet type across all wards
  const patientTotals = {};
  dietTypes.forEach((dt) => {
    patientTotals[dt.code] = 0;
  });

  // Sum special requests across all wards (dynamic — from recipes table)
  const specialCounts = {};

  // Sum extra items across all wards (raw sums)
  const extrasTotals = {};
  const customExtrasTotals = {};

  for (const row of censusRows) {
    const diets = row.diets || {};

    // Aggregate patient counts by diet type code
    for (const [key, value] of Object.entries(diets)) {
      const count = Number(value) || 0;
      const dt = dietTypes.find(
        (d) => String(d.code) === String(key) || String(d.id) === String(key)
      );
      if (dt) {
        patientTotals[dt.code] = (patientTotals[dt.code] || 0) + count;
      }
    }

    // Aggregate specials dynamically (any recipe key from census special JSONB)
    const special = row.special || {};
    for (const [key, value] of Object.entries(special)) {
      specialCounts[key] = (specialCounts[key] || 0) + (Number(value) || 0);
    }

    // Aggregate extras (raw sum)
    const extras = row.extras || {};
    for (const [name, qty] of Object.entries(extras)) {
      const val = Number(qty) || 0;
      if (val > 0) {
        extrasTotals[name] = (extrasTotals[name] || 0) + val;
      }
    }

    // Aggregate custom extras
    const customExtras = row.custom_extras || [];
    for (const ce of customExtras) {
      const ceKey = ce.name;
      const ceQty = Number(ce.quantity) || 0;
      if (ceQty > 0) {
        if (!customExtrasTotals[ceKey]) {
          customExtrasTotals[ceKey] = { name: ce.name, unit: ce.unit, quantity: 0 };
        }
        customExtrasTotals[ceKey].quantity += ceQty;
      }
    }
  }

  return {
    patientTotals,
    specialCounts,
    extrasTotals,
    customExtrasTotals: Object.values(customExtrasTotals),
  };
}



function calculateNormWeightItems(items, normWeights, dietTypes, patientTotals, staffRow) {
  const MEALS = ["breakfast", "lunch", "dinner"];
  const results = []; // Array of { itemId, meal, breakdown, subtotalBase, baseUnit, displayValue, displayUnit }

  // Build a fast lookup: normWeights[itemId][meal][dietTypeId] = weight_g
  const nwLookup = {};
  for (const nw of normWeights) {
    if (!nwLookup[nw.item_id]) nwLookup[nw.item_id] = {};
    if (!nwLookup[nw.item_id][nw.meal]) nwLookup[nw.item_id][nw.meal] = {};
    nwLookup[nw.item_id][nw.meal][nw.diet_type_id] = Number(nw.weight) || 0;
  }

  // Filter to norm-weight items only (not extras with raw_sum)
  const normItems = items.filter(
    (i) => i.calc_type === "norm_weight" && !i.is_extra
  );

  for (const item of normItems) {
    const itemWeights = nwLookup[item.id] || {};
    const { base: baseUnit } = getBaseUnit(item.unit);

    for (const meal of MEALS) {
      const mealWeights = itemWeights[meal] || {};
      const breakdown = {};
      let subtotalBase = 0;

      // Patient diet types
      for (const dt of dietTypes) {
        if (dt.type === "Staff") continue; // Staff handled separately

        const normG = mealWeights[dt.id] || 0;
        const count = patientTotals[dt.code] || 0;
        const totalG = normG * count;

        if (normG > 0 || count > 0) {
          breakdown[dt.code] = {
            dietTypeId: dt.id,
            code: dt.code,
            nameEn: dt.name_en,
            count,
            normG,
            totalG,
          };
        }
        subtotalBase += totalG;
      }

      // Staff calculation
      const staffDietType = dietTypes.find((d) => d.type === "Staff");
      if (staffDietType && staffRow) {
        const staffNormG = mealWeights[staffDietType.id] || 0;
        let staffCount = 0;
        if (meal === "breakfast") staffCount = staffRow.breakfast || 0;
        else if (meal === "lunch") staffCount = staffRow.lunch || 0;
        else if (meal === "dinner") staffCount = staffRow.dinner || 0;

        const staffTotalG = staffNormG * staffCount;

        breakdown["STAFF"] = {
          dietTypeId: staffDietType.id,
          code: "STAFF",
          nameEn: "Staff",
          count: staffCount,
          normG: staffNormG,
          totalG: staffTotalG,
        };
        subtotalBase += staffTotalG;
      }

      // Only add if there's something to report
      if (subtotalBase > 0) {
        const displayValue = roundDisplay(toDisplayUnit(subtotalBase, item.unit), item.unit);

        results.push({
          itemId: item.id,
          meal,
          breakdown,
          subtotalBase,
          baseUnit,
          displayValue,
          displayUnit: item.unit,
        });
      }
    }
  }

  return results;
}


// 
function filterProteinByActiveCycle(results, items, patientCycle, staffCycle, dietTypes) {
  // Build a lookup: dietTypeCode → type ("Patient", "Paediatric", "Special", "Staff", "Extra")
  const dietTypeLookup = {};
  for (const dt of dietTypes) {
    dietTypeLookup[dt.code] = dt.type;
  }

  return results.filter((r) => {
    const item = items.find((i) => i.id === r.itemId);
    if (!item || !item.is_protein) return true; // Non-protein items always pass through

    const itemCycle = (item.diet_cycle || "").toLowerCase();
    const patCycle = (patientCycle || "").toLowerCase();
    const stfCycle = (staffCycle || "").toLowerCase();

    const matchesPatientCycle = itemCycle === patCycle;
    const matchesStaffCycle = itemCycle === stfCycle;

    // Process each diet type entry in the breakdown
    for (const [code, data] of Object.entries(r.breakdown)) {
      if (code === "STAFF") {
        // ─── STAFF: follows staff cycle only ───
        if (!matchesStaffCycle) {
          data.totalG = 0;
          data.count = 0;
        }
      } else {
        // ─── Determine if this diet type is "Special" ───
        const dtType = dietTypeLookup[code] || "Patient";
        const isSpecialDiet = dtType === "Special";

        if (isSpecialDiet) {
          // SPECIAL diets (HPD, etc.): keep protein if norm > 0
          // regardless of which cycle is active
          // normG > 0 means Hospital Admin explicitly configured this
          if (data.normG === 0) {
            data.totalG = 0;
            data.count = 0;
          }
          // If normG > 0, keep as-is — HPD gets chicken even on Vegetable day
        } else {
          // REGULAR diets (Normal, Diabetic, S1-S5, Breakfast Extra):
          // strictly follow the patient cycle
          if (!matchesPatientCycle) {
            // Cycle not active → zero out, even if norm > 0
            data.totalG = 0;
            data.count = 0;
          }
          // If cycle IS active, keep as-is
        }
      }
    }

    // Recalculate subtotal after filtering
    r.subtotalBase = Object.values(r.breakdown).reduce((s, v) => s + v.totalG, 0);
    r.displayValue = roundDisplay(toDisplayUnit(r.subtotalBase, r.displayUnit), r.displayUnit);

    return r.subtotalBase > 0; // Drop if nothing left after filtering
  });
}


function calculateVegSummaries(results, items) {
  const vegCategories = {}; // { palaa: totalKg, gedi: totalKg, ... }

  for (const r of results) {
    const item = items.find((i) => i.id === r.itemId);
    if (!item || !item.is_vegetable || !item.veg_category) continue;

    const cat = item.veg_category.toLowerCase();
    if (!vegCategories[cat]) vegCategories[cat] = 0;

    // Convert base unit total to Kg for vegetables
    vegCategories[cat] += r.subtotalBase / 1000; // g → Kg
  }

  // Round
  for (const key of Object.keys(vegCategories)) {
    vegCategories[key] = Math.round(vegCategories[key] * 100) / 100;
  }

  return vegCategories;
}


function calculateRecipes(
  recipes,
  recipeIngredients,
  recipeDietFactors,
  patientTotals,
  staffRow,
  dietTypes,
  specialCounts // { polSambola: 45, soup: 30, kanda: 12, anyNewRecipe: 5 }
) {
  const recipeResults = [];

  for (const recipe of recipes) {
    // Dynamic lookup: match recipe_key against specialCounts keys
    let rawCount = 0;
    if (specialCounts[recipe.recipe_key] !== undefined) {
      rawCount = specialCounts[recipe.recipe_key];
    } else {
      // Fallback: case-insensitive match
      const keyLower = recipe.recipe_key.toLowerCase();
      for (const [sKey, sVal] of Object.entries(specialCounts)) {
        if (sKey.toLowerCase() === keyLower) {
          rawCount = sVal;
          break;
        }
      }
    }

    if (rawCount === 0) continue; // No one ordered this recipe

    // Get diet factors for this recipe
    const factors = recipeDietFactors.filter(
      (f) => f.recipe_id === recipe.id
    );

    // Calculate weighted count using diet conversion factors
    let weightedCount = 0;
    const staffDietType = dietTypes.find((d) => d.type === "Staff");

    for (const dt of dietTypes) {
      if (dt.type === "Staff") continue;

      const count = patientTotals[dt.code] || 0;
      if (count === 0) continue;

      // Find the factor for this diet type, default to 1.0
      const factorRow = factors.find((f) => f.diet_type_id === dt.id);
      const factor = factorRow ? Number(factorRow.factor) : 1.0;

      weightedCount += count * factor;
    }

    // Add staff breakfast count (staff factor)
    if (staffRow && staffDietType) {
      const staffFactor = factors.find((f) => f.diet_type_id === staffDietType.id);
      const sf = staffFactor ? Number(staffFactor.factor) : 1.0;
      weightedCount += (staffRow.breakfast || 0) * sf;
    }

    // Calculate ingredient quantities
    const ingredients = recipeIngredients
      .filter((ri) => ri.recipe_id === recipe.id)
      .map((ri) => ({
        itemId: ri.item_id,
        nameEn: ri.name_en,
        nameSi: ri.name_si,
        normPerPatient: Number(ri.norm_per_patient),
        unit: ri.unit,
        qty: Math.round(Number(ri.norm_per_patient) * weightedCount * 100) / 100,
      }));

    recipeResults.push({
      recipeId: recipe.id,
      recipeKey: recipe.recipe_key,
      recipeName: recipe.name,
      rawPatientCount: rawCount,
      weightedCount: Math.round(weightedCount * 100) / 100,
      ingredients,
    });
  }

  return recipeResults;
}


function buildGrandTotals(lineItems, items) {
  const totals = {}; // itemId → { breakfast, lunch, dinner, grandTotal (display unit) }

  for (const li of lineItems) {
    if (!totals[li.itemId]) {
      const item = items.find((i) => i.id === li.itemId);
      totals[li.itemId] = {
        itemId: li.itemId,
        nameEn: item?.name_en || "",
        nameSi: item?.name_si || "",
        unit: item?.unit || "Kg",
        categoryId: item?.category_id,
        isProtein: item?.is_protein || false,
        isVegetable: item?.is_vegetable || false,
        vegCategory: item?.veg_category,
        breakfast: null,
        lunch: null,
        dinner: null,
        grandTotalBase: 0,
        grandTotal: 0,
        forBreakfast: false,
        forLunch: false,
        forDinner: false,
      };
    }

    const t = totals[li.itemId];
    t[li.meal] = li.displayValue;
    t.grandTotalBase += li.subtotalBase;

    if (li.meal === "breakfast") t.forBreakfast = true;
    if (li.meal === "lunch") t.forLunch = true;
    if (li.meal === "dinner") t.forDinner = true;
  }

  // Calculate display grand total
  for (const t of Object.values(totals)) {
    t.grandTotal = roundDisplay(toDisplayUnit(t.grandTotalBase, t.unit), t.unit);
  }

  return Object.values(totals);
}


function buildPOLineItems(grandTotals, items) {
  return grandTotals.map((gt) => {
    const item = items.find((i) => i.id === gt.itemId);
    const unitPrice = Number(item?.default_price) || 0;

    return {
      itemId: gt.itemId,
      categoryId: gt.categoryId,
      calculatedQty: gt.grandTotal,
      displayUnit: gt.unit,
      unitPrice,
      totalPrice: Math.round(gt.grandTotal * unitPrice * 100) / 100,
      forBreakfast: gt.forBreakfast,
      forLunch: gt.forLunch,
      forDinner: gt.forDinner,
      forExtra: false,
      forKanda: false,
    };
  });
}


async function runCalculation(calcDate, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Gather all inputs
    const inputs = await gatherInputs(calcDate);
    const {
      censusRows,
      staffRow,
      cycleRow,
      dietTypes,
      items,
      normWeights,
      recipes,
      recipeIngredients,
      recipeDietFactors,
    } = inputs;

    if (censusRows.length === 0) {
      throw new Error("No submitted census entries found for this date");
    }

    const patientCycle = cycleRow.patient_cycle;
    const staffCycle = cycleRow.staff_cycle;

    // Aggregate ward data
    const aggregated = aggregateWardData(censusRows, dietTypes);

    // Calculate all norm-weight items
    let lineItems = calculateNormWeightItems(
      items,
      normWeights,
      dietTypes,
      aggregated.patientTotals,
      staffRow
    );

    // Filter protein by active cycle
    lineItems = filterProteinByActiveCycle(lineItems, items, patientCycle, staffCycle, dietTypes);

    // Vegetable summaries
    const vegSummaries = calculateVegSummaries(lineItems, items);

    // Recipe calculations
    const recipeResults = calculateRecipes(
      recipes,
      recipeIngredients,
      recipeDietFactors,
      aggregated.patientTotals,
      staffRow,
      dietTypes,
      aggregated.specialCounts
    );

    // Grand totals
    const grandTotals = buildGrandTotals(lineItems, items);

    // PO line items
    const poLineItems = buildPOLineItems(grandTotals, items);

    // ── PERSIST TO DATABASE ──

    // Delete any existing calculation for this date
    const existingRun = await client.query(
      `SELECT id FROM calculation_runs WHERE calc_date = $1`,
      [calcDate]
    );
    if (existingRun.rows.length > 0) {
      // Delete any purchase orders linked to the old calculation run first
      await client.query(
        `DELETE FROM purchase_orders WHERE calc_run_id IN (SELECT id FROM calculation_runs WHERE calc_date = $1)`,
        [calcDate]
      );
      await client.query(
        `DELETE FROM calculation_runs WHERE calc_date = $1`,
        [calcDate]
      );
    }

    // Insert calculation run
    const runRes = await client.query(
      `INSERT INTO calculation_runs (
        calc_date, patient_cycle, staff_cycle,
        patient_totals, staff_breakfast, staff_lunch, staff_dinner,
        soup_count, kanda_count, pol_sambola_count,
        extras_totals, custom_extras_totals,
        calculated_by, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'calculated')
      RETURNING id`,
      [
        calcDate,
        patientCycle,
        staffCycle,
        JSON.stringify(aggregated.patientTotals),
        staffRow?.breakfast || 0,
        staffRow?.lunch || 0,
        staffRow?.dinner || 0,
        aggregated.specialCounts.soup || 0,
        aggregated.specialCounts.kanda || 0,
        aggregated.specialCounts.polSambola || 0,
        JSON.stringify(aggregated.extrasTotals),
        JSON.stringify(aggregated.customExtrasTotals),
        userId,
      ]
    );
    const calcRunId = runRes.rows[0].id;

    // Insert line items
    for (const li of lineItems) {
      await client.query(
        `INSERT INTO calculation_line_items
         (calc_run_id, item_id, meal, breakdown, subtotal_base, base_unit, display_value, display_unit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          calcRunId,
          li.itemId,
          li.meal,
          JSON.stringify(li.breakdown),
          li.subtotalBase,
          li.baseUnit,
          li.displayValue,
          li.displayUnit,
        ]
      );
    }

    // Insert veg summaries
    for (const [cat, requiredKg] of Object.entries(vegSummaries)) {
      await client.query(
        `INSERT INTO calculation_veg_summaries (calc_run_id, veg_category, required_kg)
         VALUES ($1, $2, $3)`,
        [calcRunId, cat, requiredKg]
      );
    }

    // Insert recipe results
    for (const rr of recipeResults) {
      await client.query(
        `INSERT INTO calculation_recipe_results
         (calc_run_id, recipe_id, patient_count, weighted_count, ingredients)
         VALUES ($1,$2,$3,$4,$5)`,
        [calcRunId, rr.recipeId, rr.rawPatientCount, rr.weightedCount, JSON.stringify(rr.ingredients)]
      );
    }

    // Insert PO line items
    for (const po of poLineItems) {
      await client.query(
        `INSERT INTO po_line_items
         (calc_run_id, item_id, category_id, calculated_qty, display_unit,
          unit_price, total_price, for_breakfast, for_lunch, for_dinner, for_extra, for_kanda)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          calcRunId, po.itemId, po.categoryId, po.calculatedQty,
          po.displayUnit, po.unitPrice, po.totalPrice,
          po.forBreakfast, po.forLunch, po.forDinner, po.forExtra, po.forKanda,
        ]
      );
    }

    await client.query("COMMIT");

    return {
      calcRunId,
      date: calcDate,
      patientCycle,
      staffCycle,
      aggregated,
      grandTotals,
      vegSummaries,
      recipeResults,
      poLineItems,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


async function getCalculationResults(calcDate) {
  const runRes = await pool.query(
    `SELECT * FROM calculation_runs WHERE calc_date = $1 LIMIT 1`,
    [calcDate]
  );

  if (runRes.rows.length === 0) return null;

  const run = runRes.rows[0];

  // Get line items with item details
  const lineItemsRes = await pool.query(
    `SELECT cli.*, i.name_en, i.name_si, i.unit, i.category_id,
            i.is_protein, i.is_vegetable, i.veg_category, i.is_extra,
            c.name as category_name
     FROM calculation_line_items cli
     JOIN items i ON i.id = cli.item_id
     LEFT JOIN categories c ON c.id = i.category_id
     WHERE cli.calc_run_id = $1
     ORDER BY i.category_id, i.id, cli.meal`,
    [run.id]
  );

  // Get veg summaries
  const vegRes = await pool.query(
    `SELECT * FROM calculation_veg_summaries WHERE calc_run_id = $1`,
    [run.id]
  );

  // Get recipe results
  const recipeRes = await pool.query(
    `SELECT crr.*, r.recipe_key, r.name as recipe_name
     FROM calculation_recipe_results crr
     JOIN recipes r ON r.id = crr.recipe_id
     WHERE crr.calc_run_id = $1`,
    [run.id]
  );

  // Get PO line items
  const poRes = await pool.query(
    `SELECT po.*, i.name_en, i.name_si, i.unit, i.default_price,
            c.name as category_name
     FROM po_line_items po
     JOIN items i ON i.id = po.item_id
     LEFT JOIN categories c ON c.id = po.category_id
     WHERE po.calc_run_id = $1
     ORDER BY po.category_id, i.id`,
    [run.id]
  );

  return {
    run: {
      id: run.id,
      date: run.calc_date instanceof Date
        ? run.calc_date.toISOString().split("T")[0]
        : String(run.calc_date).split("T")[0],
      patientCycle: run.patient_cycle,
      staffCycle: run.staff_cycle,
      patientTotals: run.patient_totals,
      staffBreakfast: run.staff_breakfast,
      staffLunch: run.staff_lunch,
      staffDinner: run.staff_dinner,
      soupCount: run.soup_count,
      kandaCount: run.kanda_count,
      polSambolaCount: run.pol_sambola_count,
      specialCounts: run.special_counts || {
        soup: run.soup_count,
        kanda: run.kanda_count,
        polSambola: run.pol_sambola_count,
      },
      extrasTotals: run.extras_totals,
      customExtrasTotals: run.custom_extras_totals,
      status: run.status,
      calculatedAt: run.calculated_at,
    },
    lineItems: lineItemsRes.rows.map((r) => ({
      id: r.id,
      itemId: r.item_id,
      nameEn: r.name_en,
      nameSi: r.name_si,
      unit: r.unit,
      categoryId: r.category_id,
      categoryName: r.category_name,
      meal: r.meal,
      breakdown: r.breakdown,
      subtotalBase: Number(r.subtotal_base),
      baseUnit: r.base_unit,
      displayValue: Number(r.display_value),
      displayUnit: r.display_unit,
      isProtein: r.is_protein,
      isVegetable: r.is_vegetable,
      vegCategory: r.veg_category,
    })),
    vegSummaries: vegRes.rows.map((r) => ({
      vegCategory: r.veg_category,
      requiredKg: Number(r.required_kg),
    })),
    recipeResults: recipeRes.rows.map((r) => ({
      recipeId: r.recipe_id,
      recipeKey: r.recipe_key,
      recipeName: r.recipe_name,
      patientCount: r.patient_count,
      weightedCount: Number(r.weighted_count),
      ingredients: r.ingredients,
    })),
    poLineItems: poRes.rows.map((r) => ({
      id: r.id,
      itemId: r.item_id,
      nameEn: r.name_en,
      nameSi: r.name_si,
      unit: r.unit,
      categoryId: r.category_id,
      categoryName: r.category_name,
      calculatedQty: Number(r.calculated_qty),
      displayUnit: r.display_unit,
      unitPrice: Number(r.unit_price),
      defaultPrice: Number(r.default_price),
      totalPrice: Number(r.total_price),
      forBreakfast: r.for_breakfast,
      forLunch: r.for_lunch,
      forDinner: r.for_dinner,
      forExtra: r.for_extra,
      forKanda: r.for_kanda,
    })),
  };
}


async function getDailyHistory() {
  const result = await pool.query(`
    SELECT
        all_dates.d as history_date,
        COUNT(DISTINCT ce.ward_id) as submitted_wards,
        MAX(cr.status) as calc_status,
        MAX(po.id) as po_id,
        MAX(po.bill_number) as bill_number,
        MAX(po.status) as po_status,
        MAX(po.original_total) as original_total,
        MAX(po.revised_total) as revised_total
    FROM
        (
            SELECT CAST(entry_date AS VARCHAR) as d FROM census_entries
            UNION
            SELECT CAST(calc_date AS VARCHAR) as d FROM calculation_runs
            UNION
            SELECT CAST(po_date AS VARCHAR) as d FROM purchase_orders
        ) all_dates
    LEFT JOIN census_entries ce ON CAST(ce.entry_date AS VARCHAR) = all_dates.d
    LEFT JOIN calculation_runs cr ON CAST(cr.calc_date AS VARCHAR) = all_dates.d
    LEFT JOIN purchase_orders po ON CAST(po.po_date AS VARCHAR) = all_dates.d
    GROUP BY all_dates.d
    ORDER BY all_dates.d DESC
    LIMIT 90
  `);
  
  return result.rows.map(row => ({
    date: row.history_date instanceof Date ? row.history_date.toISOString().split("T")[0] : String(row.history_date).split("T")[0],
    submittedWards: Number(row.submitted_wards),
    calcStatus: row.calc_status,
    poId: row.po_id,
    billNumber: row.bill_number,
    poStatus: row.po_status,
    grandTotal: row.revised_total !== null ? Number(row.revised_total) : Number(row.original_total)
  }));
}


module.exports = {
  runCalculation,
  getCalculationResults,
  gatherInputs,
  aggregateWardData,
  calculateNormWeightItems,
  filterProteinByActiveCycle,
  calculateVegSummaries,
  calculateRecipes,
  buildGrandTotals,
  buildPOLineItems,
  getDailyHistory
};