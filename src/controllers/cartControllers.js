const User = require("../models/UserModel");
const Product = require("../models/ProductModels");
const asyncHandler = require("../middleware/asyncHandler");

const getCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: "cart.product",
    select: "name price comparePrice images stock isActive",
  });

  const validCartItems = user.cart.filter(
    (item) => item.product && item.product.isActive,
  );

  const subtotal = validCartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  res.status(200).json({
    success: true,
    data: {
      items: validCartItems,
      subtotal,
      itemCount: validCartItems.reduce((sum, item) => sum + item.quantity, 0),
    },
  });
});

const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    return res
      .status(400)
      .json({ success: false, message: "productId is required" });
  }
  if (quantity < 1) {
    return res
      .status(400)
      .json({ success: false, message: "Quantity minimun 1 required" });
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    return res
      .status(404)
      .json({ success: false, message: "Product is not find" });
  }

  if (product.stock < quantity) {
    return res.status(400).json({
      success: false,
      message: ` ${product.stock} items available`,
    });
  }

  const user = await User.findById(req.user._id);

  const existingItem = user.cart.find(
    (item) => item.product.toString() === productId,
  );

  if (existingItem) {
    const newQuantity = existingItem.quantity + Number(quantity);

    if (product.stock < newQuantity) {
      return res.status(400).json({
        success: false,
        message: `${product.stock} items available, in cart ${existingItem.quantity}`,
      });
    }

    existingItem.quantity = newQuantity;
  } else {
    user.cart.push({ product: productId, quantity: Number(quantity) });
  }

  await user.save();

  const updatedUser = await User.findById(req.user._id).populate({
    path: "cart.product",
    select: "name price comparePrice images stock isActive",
  });

  res.status(200).json({
    success: true,
    message: "Add to Cart",
    data: updatedUser.cart,
  });
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const { productId } = req.params;

  if (!quantity || quantity < 1) {
    return res
      .status(400)
      .json({ success: false, message: "Send valid quantity" });
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    return res
      .status(404)
      .json({ success: false, message: "Product is not find" });
  }

  if (product.stock < quantity) {
    return res.status(400).json({
      success: false,
      message: `${product.stock} items available`,
    });
  }

  const user = await User.findById(req.user._id);
  const cartItem = user.cart.find(
    (item) => item.product.toString() === productId,
  );

  if (!cartItem) {
    return res
      .status(404)
      .json({ success: false, message: "This product is not in the cart." });
  }

  cartItem.quantity = Number(quantity);
  await user.save();

  const updatedUser = await User.findById(req.user._id).populate({
    path: "cart.product",
    select: "name price comparePrice images stock isActive",
  });

  res.status(200).json({
    success: true,
    message: "Cart update ho gaya",
    data: updatedUser.cart,
  });
});

const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const user = await User.findById(req.user._id);

  const itemExists = user.cart.some(
    (item) => item.product.toString() === productId,
  );
  if (!itemExists) {
    return res
      .status(404)
      .json({ success: false, message: "This product is not in the cart." });
  }

  user.cart = user.cart.filter((item) => item.product.toString() !== productId);
  await user.save();

  res.status(200).json({
    success: true,
    message: "Cart se item remove ho gaya",
    data: user.cart,
  });
});

const clearCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.cart = [];
  await user.save();

  res
    .status(200)
    .json({ success: true, message: "The cart has been cleared.", data: [] });
});
module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
