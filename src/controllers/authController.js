const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/UserModel");
const asyncHandler = require("../middleware/asyncHandler");
const nodemailer = require("nodemailer");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
  tls: { rejectUnauthorized: false },
});

const authResponse = (res, statusCode, user) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

const sendEmail = async ({ email, subject, message }) => {
  await transporter.sendMail({
    from: `"Furniro Support" <${process.env.BREVO_USER}>`,
    to: email,
    subject,
    html: message,
  });
};

const generateOtp = () =>
  Math.floor(100_000 + Math.random() * 900_000).toString();

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

  try {
    await sendEmail({
      email: user.email,
      subject: "Welcome to Furniro",
      message: `
        <h2>Welcome to Furniro, ${name}!</h2>
        <p>Thank you for registering on our platform.</p>
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

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password",
  );
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

const logout = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: "Logged out successfully" });
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

  if (req.file) updates.avatar = req.file.path;

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

//forget password otp and change password flow
const sendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const otp = generateOtp();
  user.otp = await bcrypt.hash(otp, 10);
  user.otpExpiry = Date.now() + 5 * 60 * 1000;

  await user.save();

  await transporter.sendMail({
    from: `"Furniro Support" <${process.env.BREVO_SENDER_EMAIL}>`,
    to: user.email,
    subject: "Password Reset OTP",
    html: `
      <h2>Password Reset Request</h2>
      <p>Your one-time OTP is:</p>
      <h1 style="letter-spacing:4px">${otp}</h1>
      <p>This OTP expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });

  res.status(200).json({ success: true, message: "OTP sent to your email" });
});
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  console.log("Email:", email);
  console.log("OTP:", otp);

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required",
    });
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
  }).select("+otp");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  const otpValid = user.otp && (await bcrypt.compare(otp, user.otp));

  const otpExpired = !user.otpExpiry || user.otpExpiry < Date.now();

  if (!otpValid || otpExpired) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  user.isOtpVerified = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: "OTP verified successfully",
  });
});
const resetPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and newPassword are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters",
    });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password",
  );
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!user.isOtpVerified) {
    return res.status(400).json({
      success: false,
      message: "Please verify OTP first",
    });
  }

  user.password = password;

  user.otp = undefined;
  user.otpExpiry = undefined;
  user.isOtpVerified = false;

  await user.save();
  authResponse(res, 200, user);
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateMe,
  changePassword,
  getUsers,
  sendOtp,
  verifyOtp,
  resetPassword,
};
