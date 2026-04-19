const pool = require("../config/db");

// Create a new audit log entry
const createAuditLog = async ({
  user_id = null,
  user_name = "System",
  user_role = null,
  action,
  entity,
  entity_id = null,
  old_value = null,
  new_value = null,
  details = null,
  severity = "info",
  status_code = null,
  success = true,
}) => {
  const query = `
    INSERT INTO audit_logs (
      user_id,
      user_name,
      user_role,
      action,
      entity,
      entity_id,
      old_value,
      new_value,
      details,
      severity,
      status_code,
      success
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *
  `;
  // Ensure severity is one of the allowed values
  const values = [
    user_id,
    user_name,
    user_role,
    action,
    entity,
    entity_id,
    old_value,
    new_value,
    details,
    severity,
    status_code,
    success,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// Retrieve all audit logs, optionally filtered by action
const getAllAuditLogs = async (action = null) => {
  let query = `
    SELECT
      id,
      timestamp,
      user_id,
      user_name AS user,
      user_role AS role,
      action,
      entity,
      entity_id,
      old_value AS "oldValue",
      new_value AS "newValue",
      details,
      severity,
      status_code,
      success
    FROM audit_logs
  `;
  const values = []; // For parameterized query

  // If an action filter is provided and it's not "all", add a WHERE clause
  if (action && action !== "all") {
    query += ` WHERE action = $1`;
    values.push(action);
  }

  query += ` ORDER BY timestamp DESC`; // Order by most recent first
  
  // Execute the query and return the results
  const result = await pool.query(query, values);
  return result.rows;
};

// Retrieve distinct audit actions for filtering
const getAuditActions = async () => {
  const query = `
    SELECT DISTINCT action
    FROM audit_logs
    ORDER BY action ASC
  `;
  const result = await pool.query(query);
  return result.rows;
};

module.exports = {
  createAuditLog,
  getAllAuditLogs,
  getAuditActions,
};