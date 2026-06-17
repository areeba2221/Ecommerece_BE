require('dotenv').config();   // ← sabse pehle — env variables load karne ke liye

const cors    = require('cors');
const express = require('express');
const morgan  = require('morgan');

const app = express();

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.ORIGIN || "http://localhost:3000",
  credentials: true,
}));

// ── Logger (sirf development mein) ────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan('dev'));
}

// ── Routes ───────────────────────────────────────────────────────────────────
const productRoutes = require('./routes/productRoutes');
const authRoutes    = require('./routes/authRoutes');
const userRoutes    = require('./routes/userRoutes');
const cartRoutes    = require('./routes/cartRoutes');

app.use("/api/products", productRoutes);
app.use("/api/auth",     authRoutes);
app.use("/api/users",    userRoutes);   // ← plural, taake /api/users match ho
app.use("/api/cart",     cartRoutes);

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ success: true, message: "API is running" });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

module.exports = app;