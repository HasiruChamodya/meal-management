const auditModel = require("../models/auditModel");

// GET /api/audit/logs
exports.getAuditLogs = async (req, res) => {
  try {
    const { action = "all" } = req.query; 
    const logs = await auditModel.getAllAuditLogs(action); // Fetch logs based on action filter

    res.status(200).json({ // 200 OK
      logs: logs.slice(0, 50), // return only last 50
    });
  } 
  catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" }); // Generic error message for client 500 Internal Server Error
  }
};

// GET /api/audit/actions
exports.getAuditActions = async (req, res) => {
  try {
    const actions = await auditModel.getAuditActions();
    res.status(200).json({ actions: actions.map((a) => a.action) });
  } 
  catch (error) {
    console.error("GET AUDIT ACTIONS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch audit actions" }); // Generic error message for client
  }
};