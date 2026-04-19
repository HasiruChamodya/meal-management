/**
Unit of Measurement (UOM) Utilities
ALL calculations happen in BASE UNITS:
 Mass   → grams (g)
 Volume → milliliters (ml)
 Count  → pieces (pcs)
  Only at display time do we convert to the item's preferred unit.
 */

// Map item units → base unit type
const UNIT_TO_BASE = {
  // Mass
  "Kg":   { base: "g",   factor: 1000 },
  "g":    { base: "g",   factor: 1 },
  "100g": { base: "g",   factor: 100 },
  "400g": { base: "g",   factor: 400 },

  // Volume
  "L":      { base: "ml", factor: 1000 },
  "1L":     { base: "ml", factor: 1000 },
  "ml":     { base: "ml", factor: 1 },
  "180ml":  { base: "ml", factor: 180 },
  "375ml":  { base: "ml", factor: 375 },

  // Discrete / Count
  "One":    { base: "pcs", factor: 1 },
  "Pcs":    { base: "pcs", factor: 1 },
  "Fruit":  { base: "pcs", factor: 1 },
  "Cup":    { base: "pcs", factor: 1 },
  "Bottle": { base: "pcs", factor: 1 },
  "Pk":     { base: "pcs", factor: 1 },
  "Pkt":    { base: "pcs", factor: 1 },

  // Special
  "1 loaf":  { base: "loaf", factor: 1 },
  "seeds":   { base: "seeds", factor: 1 },
};

/**
 * Get the base unit info for an item's display unit.
 * @param {string} displayUnit - e.g. "Kg", "Pcs", "1 loaf"
 * @returns {{ base: string, factor: number }}
 */
function getBaseUnit(displayUnit) {
  return UNIT_TO_BASE[displayUnit] || { base: displayUnit, factor: 1 };
}

/**
 * Convert a value from base unit to display unit.
 * e.g., 7355g → 7.355 Kg (divide by 1000)
 * e.g., 6 pcs → 6 Pcs (divide by 1)
 *
 * @param {number} baseValue - Value in base unit (g, ml, pcs)
 * @param {string} displayUnit - Target display unit ("Kg", "L", etc.)
 * @returns {number}
 */
function toDisplayUnit(baseValue, displayUnit) {
  const { factor } = getBaseUnit(displayUnit);
  if (factor === 0) return 0;
  return baseValue / factor;
}

/**
 * Convert a value from display unit to base unit.
 * e.g., 7.355 Kg → 7355g (multiply by 1000)
 *
 * @param {number} displayValue
 * @param {string} displayUnit
 * @returns {number}
 */
function toBaseUnit(displayValue, displayUnit) {
  const { factor } = getBaseUnit(displayUnit);
  return displayValue * factor;
}

/**
 * Round a display value to a sensible precision.
 * Mass (Kg): 2 decimal places
 * Count: whole numbers
 * Everything else: 2 decimal places
 */
function roundDisplay(value, displayUnit) {
  const { base } = getBaseUnit(displayUnit);
  if (base === "pcs" || base === "loaf" || base === "seeds") {
    // For discrete items, round to 2 decimals (some items like bread = 11.75 loaves)
    return Math.round(value * 100) / 100;
  }
  // Mass/volume: 2 decimal places
  return Math.round(value * 100) / 100;
}

module.exports = {
  getBaseUnit,
  toDisplayUnit,
  toBaseUnit,
  roundDisplay,
  UNIT_TO_BASE,
};