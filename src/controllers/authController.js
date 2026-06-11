const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");
const asyncHandler = require("../middleware/asyncHandler");
const sendEmail = require("../utils/sendEmail")

const signToken = (id) =>
    jwt.sign({id} , process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

const authResponse = (res, statusCode, user) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id:   user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  });
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email and password are required",
    });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "Email already registered",
    });
  }

  const user = await User.create({ name, email, password, phone });

  const otp = Math.floor(100_000 + Math.random() * 900_000);

  try {
    await sendEmail({
      email: user.email,
      subject: "Welcome to Furniro – Your OTP",
      message: `
        <h2>Welcome to Furniro, ${name}!</h2>
        <p>Thank you for registering on our platform.</p>
        <p>Your one-time verification OTP is: <strong>${otp}</strong></p>
      `,
    });
  } catch (emailErr) {
    console.error("Welcome email failed:", emailErr.message);
  }

  authResponse(res, 201, user);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: "Account has been deactivated",
    });
  }

  authResponse(res, 200, user);
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({ success: true, data: user });
});

const updateMe = asyncHandler(async (req, res) => {
  const allowed = ["name", "phone", "addresses"];
  const updates = {};

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (req.file) {
    updates.avatar = req.file.path;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: user });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Both currentPassword and newPassword are required",
    });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters",
    });
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.matchPassword(currentPassword))) {
    return res.status(401).json({
      success: false,
      message: "Current password is incorrect",
    });
  }

  user.password = newPassword;
  await user.save();

  authResponse(res, 200, user);
});
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select("-password");
  res.status(200).json({ success: true, count: users.length, data: users });
});

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  getUsers,
};

