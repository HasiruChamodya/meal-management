const express = require("express");
const router = express.Router();
const auditController = require("../controllers/auditController");

// GET /api/audit/logs
router.get("/", auditController.getAuditLogs);

// GET /api/audit/actions
router.get("/actions", auditController.getAuditActions);

module.exports = router;