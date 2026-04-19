const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { writeAudit } = require("../utils/audit");

// Allowed roles for registration
const ALLOWED_ROLES = new Set([
  "SYSTEM_ADMIN",
  "HOSPITAL_ADMIN",
  "DIET_CLERK",
  "SUBJECT_CLERK",
  "ACCOUNTANT",
  "KITCHEN",
]);

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body; // Extract full_name from request body

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({  // 400 Bad Request
        message: "full_name, email, password, role are required", 
      });
    }

    // REGEX to enforce password complexity: minimum 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_-]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({  // 400 Bad Request
        message: "Password must be at least 8 characters long and contain one uppercase, one lowercase, one number, and one special character." 
      });
    }

    // Validate role
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ message: "Invalid role" }); 
    }

    // Check if email already exists
    const existingUser = await User.findByEmail(email);

    // Log the registration attempt with email and role for audit purposes
    if (existingUser) {
      await writeAudit({
        req,
        action: "REGISTER_FAILED_EMAIL_EXISTS",
        entity: "users",
        details: { email, full_name, role },
        severity: "security",
        status_code: 409,
        success: false,
      });

      return res.status(409).json({ message: "Email already exists" });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create the user in the database
    const newUser = await User.createUser({
      name: full_name,
      email,
      role,
      passwordHash,
    });

    // Log the successful registration with user details for audit purposes
    await writeAudit({
      req,
      action: "REGISTER_SUCCESS",
      entity: "users",
      entity_id: String(newUser.id),
      new_value: newUser,
      details: { full_name: newUser.name, email: newUser.email, role: newUser.role },
      severity: "info",
      status_code: 201,
      success: true,
    });

    // Return the created user details (excluding password) to the client
    return res.status(201).json({ // 201 Created
      message: "User created successfully",
      user: newUser,
    });
  } 
  // Catch any unexpected errors during registration
  catch (error) { 
    console.error("REGISTER ERROR:", error.message);
    console.error("DETAIL:", error.detail);
    console.error("CODE:", error.code);

    await writeAudit({ // Log the registration error with details for audit purposes
      req,
      action: "REGISTER_ERROR",
      entity: "users",
      details: {
        email: req.body?.email || null,
        role: req.body?.role || null,
        message: error.message,
        code: error.code,
      },
      severity: "security",
      status_code: 500,
      success: false,
    });

    return res.status(500).json({ // 500 Internal Server Error
      message: "Registration failed",
      error: error.message,
      detail: error.detail,
      code: error.code,
    });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try { 
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ // 400 Bad Request
        message: "email and password are required",
      });
    }

    // Find the user by email
    const user = await User.findByEmail(email);

    if (!user) {
      await writeAudit({
        req,
        action: "LOGIN_FAILED",
        entity: "users",
        details: { email, reason: "user_not_found" },
        severity: "security",
        status_code: 401,
        success: false,
      });

      return res.status(401).json({ message: "Invalid credentials" });
    }
    // Check if the user's account is active
    if (user.status !== "active") {
      await writeAudit({
        req,
        action: "LOGIN_BLOCKED",
        entity: "users",
        entity_id: String(user.id),
        details: {
          email: user.email,
          role: user.role,
          reason: "deactivated",
        },
        severity: "security",
        status_code: 403,
        success: false,
      });

      return res.status(403).json({ message: "Account is deactivated" });
    }

    // Compare the provided password with the stored hash
    const ok = await bcrypt.compare(password, user.password_hash);

    // Log failed login attempts with reason for audit purposes
    if (!ok) {
      await writeAudit({
        req,
        action: "LOGIN_FAILED",
        entity: "users",
        entity_id: String(user.id),
        details: {
          email: user.email,
          role: user.role,
          reason: "wrong_password",
        },
        severity: "security",
        status_code: 401,
        success: false,
      });

      return res.status(401).json({ message: "Invalid credentials" });
    }

    // If the user is required to change their password, prompt them to set a new password before allowing login
    if (user.must_change_password) {
      await writeAudit({
        req,
        action: "LOGIN_INTERCEPTED_FOR_PASSWORD_CHANGE",
        entity: "users",
        entity_id: String(user.id),
        details: { email: user.email },
        severity: "info",
        status_code: 200,
        success: true,
      });

      return res.json({
        requirePasswordChange: true,
        userId: user.id,
        message: "Your password was reset by an admin. Please set a new secure password.",
      });
    }

    // Generate a JWT token for the authenticated user
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Log the successful login with user details for audit purposes
    await writeAudit({
      req,
      action: "LOGIN_SUCCESS",
      entity: "users",
      entity_id: String(user.id),
      details: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
      severity: "info",
      status_code: 200,
      success: true,
    });

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } 
  // Catch any unexpected errors during login
  catch (error) {
    console.error("LOGIN ERROR:", error.message);
    console.error("DETAIL:", error.detail);
    console.error("CODE:", error.code);

    await writeAudit({
      req,
      action: "LOGIN_ERROR",
      entity: "users",
      details: {
        email: req.body?.email || null,
        message: error.message,
        code: error.code,
      },
      severity: "security",
      status_code: 500,
      success: false,
    });

    // Return a generic error message to the client without exposing sensitive details
    return res.status(500).json({
      message: "Login failed",
      error: error.message,
      detail: error.detail,
      code: error.code,
    });
  }
};

// POST /api/auth/set-new-password
exports.setNewPassword = async (req, res) => {
  // This endpoint allows a user to set a new password after being forced to change it by an admin.
  try {
    const { userId, newPassword } = req.body;
    const pool = require("../config/db"); 
    const { writeAudit } = require("../utils/audit");

    // Fetch user details for the audit log
    const userResult = await pool.query("SELECT email, full_name FROM users WHERE id = $1", [userId]);
    const user = userResult.rows[0];

    // REGEX to enforce password complexity: minimum 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_-]).{8,}$/;
    if (!newPassword || !passwordRegex.test(newPassword)) {
      await writeAudit({
        req,
        action: "USER_SET_PASSWORD_FAILED",
        entity: "users",
        entity_id: String(userId),
        user_name: user ? user.full_name : "System",
        details: { reason: "Password did not meet complexity requirements" },
        severity: "security",
        status_code: 400,
        success: false,
      });

      return res.status(400).json({ 
        message: "Password must be at least 8 characters long and contain one uppercase, one lowercase, one number, and one special character." 
      });
    }

    // Hash the new password
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the database with the new password hash and remove the force-change flag
    await pool.query(
      "UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2",
      [hashedPassword, userId]
    );

    // Log the successful password change
    await writeAudit({
      req,
      action: "USER_SET_NEW_PASSWORD",
      entity: "users",
      entity_id: String(userId),
      user_name: user ? user.full_name : "System",
      details: {
        message: "User successfully set their own secure password",
        email: user?.email
      },
      severity: "security", 
      status_code: 200,
      success: true,
    });

    return res.json({ message: "Password updated successfully! You can now log in." });
  } 
  // Catch any unexpected errors during the password update process
  catch (error) {
    console.error("SET NEW PASSWORD ERROR:", error);
    const { writeAudit } = require("../utils/audit");
    
    await writeAudit({
      req,
      action: "USER_SET_PASSWORD_ERROR",
      entity: "users",
      entity_id: String(req.body.userId),
      details: { error: error.message },
      severity: "security",
      status_code: 500,
      success: false,
    });

    return res.status(500).json({ message: "Server error updating password" });
  }
};