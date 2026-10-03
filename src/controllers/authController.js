const bcrypt = require("bcrypt");
const Resident = require("../models/Resident");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const generateToken = require("../utils/generateToken");
const { isValidEmail, isValidPhone, isNonEmpty } = require("../utils/validators");

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, phone, flatNumber, password, role = "resident", guardKey } = req.body;

  // ---- validation ----
  if (!isNonEmpty(name)) throw new AppError("Name is required", 400);
  if (!isNonEmpty(email) || !isValidEmail(email)) throw new AppError("A valid email is required", 400);
  if (!isNonEmpty(phone) || !isValidPhone(phone)) throw new AppError("A valid phone number is required (10-13 digits)", 400);
  if (typeof password !== "string" || password.length < 6) throw new AppError("Password must be at least 6 characters", 400);
  if (!["resident", "guard"].includes(role)) throw new AppError("Role must be 'resident' or 'guard'", 400);
  if (role === "resident" && !isNonEmpty(flatNumber)) throw new AppError("Flat number is required for residents", 400);

  // Only someone who knows the secret key may create a guard account
  if (role === "guard" && (!process.env.GUARD_REGISTER_KEY || guardKey !== process.env.GUARD_REGISTER_KEY)) {
    throw new AppError("Invalid guard registration key", 403);
  }

  // ---- duplicate check ----
  const existing = await Resident.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError("Email is already registered", 409);

  // ---- hash the password (never store plain text) ----
  const hashedPassword = await bcrypt.hash(password, 10); // 10 = salt rounds

  const user = await Resident.create({ name, email, phone, flatNumber, password: hashedPassword, role });

  res.status(201).json({
    success: true,
    message: `${role === "guard" ? "Guard" : "Resident"} registered successfully`,
    data: { id: user._id, name: user.name, email: user.email, phone: user.phone, flatNumber: user.flatNumber, role: user.role },
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!isNonEmpty(email) || typeof password !== "string" || !password) {
    throw new AppError("Email and password are required", 400);
  }

  // password has select:false, so we explicitly ask for it
  const user = await Resident.findOne({ email: email.toLowerCase() }).select("+password");
  // Same message for wrong email or wrong password (don't reveal which one is wrong)
  if (!user) throw new AppError("Invalid email or password", 401);

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new AppError("Invalid email or password", 401);

  const token = generateToken(user);
  res.status(200).json({
    success: true,
    message: "Login successful",
    data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } },
  });
});

module.exports = { register, login };
