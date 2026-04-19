const jwt = require("jsonwebtoken");

// Middleware to protect routes and check user roles
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, email }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}

// Middleware to check if user has required role(s)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(403).json({ message: "Forbidden" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };