const express = require("express");
const router  = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrder,
  markOrderPaid,
  updateOrderStatus,
  getAllOrders,
} = require("../controllers/orderController");
const { protect, authorise } = require("../middleware/auth");

router.use(protect);

router.post("/",                            createOrder);
router.get ("/my",                          getMyOrders);
router.get ("/:id",                         getOrder);
router.put ("/:id/pay",                     markOrderPaid);

router.get   ("/",          authorise("admin"), getAllOrders);
router.put   ("/:id/status", authorise("admin"), updateOrderStatus);

module.exports = router;
