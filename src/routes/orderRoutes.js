const express = require("express");
const router = express.Router();
const {
  stripeWebhook,
  createOrder,
  getMyOrders,
  getOrder,
  markOrderPaid,
  updateOrderStatus,
  getAllOrders,
  createStripeSection,
} = require("../controllers/orderController");
const { protect, authorise } = require("../middleware/auth");

router.use(protect);

router.post("/", createOrder);
router.get("/my", getMyOrders);
router.get("/:id", getOrder);
router.put("/:id/pay", markOrderPaid);
router.post("/create-stripe-session", createStripeSection);
router.get("/", authorise("admin"), getAllOrders);
router.put("/:id/status", authorise("admin"), updateOrderStatus);

module.exports = router;
