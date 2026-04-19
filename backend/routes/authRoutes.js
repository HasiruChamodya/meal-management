const router = require("express").Router();
const { register, login, setNewPassword } = require("../controllers/authController");


// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// POST /api/auth/set-new-password
router.post("/set-new-password", setNewPassword);

module.exports = router;