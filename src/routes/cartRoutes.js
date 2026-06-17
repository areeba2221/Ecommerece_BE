const express = require("express");
const router  = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} = require("../controllers/cartControllers");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get   ("/",     protect,       getCart);
router.post  ("/",            addToCart);
router.put   ("/:productId",  updateCartItem);
router.delete("/:productId",  removeFromCart);
router.delete("/",            clearCart);

module.exports = router;