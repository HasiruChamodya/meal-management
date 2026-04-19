const crypto = require("crypto");

// Middleware to generate a unique request ID and track request duration and status
function auditRequestMiddleware(req, res, next) {
  const start = Date.now();

  req.request_id = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");

  res.setHeader("x-request-id", req.request_id);

  res.on("finish", () => {
    req._duration_ms = Date.now() - start;
    req._status_code = res.statusCode;
    req._method = req.method;
    req._path = req.originalUrl;
  });

  next();
}

module.exports = { auditRequestMiddleware };