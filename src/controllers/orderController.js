const Order = require('../models/OrderModels');
const Product = require('../models/ProductModels');
const User = require('../models/UserModel');
const asyncHandler = require('../middleware/asyncHandler');

const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethods, notes } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "No order items provided" });
  }
  if (!shippingAddress) {
    return res.status(400).json({ success: false, message: "Shipping address is required" });
  }
  if (!paymentMethods) {
    return res.status(400).json({ success: false, message: "Payment method is required" });
  }

  const productIds = items.map((i) => i.product);
  const dbProducts = await Product.find({ _id: { $in: productIds }, isActive: true });

  const orderItems = [];
  for (const item of items) {
    const product = dbProducts.find((p) => p._id.toString() === item.product);
    if (!product) {
      return res.status(404).json({ success: false, message: `Product ${item.product} not found` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for "${product.name}" (available: ${product.stock})`,
      });
    }
    orderItems.push({
      product: product._id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      image: product.images?.[0]?.url || "",
    });
  }

  const itemsPrice = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shippingPrice = itemsPrice > 5000 ? 0 : 200;
  const taxRate = 0.05;
  const taxPrice = Math.round(itemsPrice * taxRate);
  const totalPrice = itemsPrice + shippingPrice + taxPrice;

  const order = await Order.create({
    user: req.user._id,
    orderItems,
    shippingAddress,
    paymentMethods,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    notes,
  });

  await Promise.all(
    orderItems.map((item) =>
      Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
    )
  );

  // make the cart empty
  const user = await User.findById(req.user._id);
  user.cart = [];
  await user.save()

  res.status(201).json({ success: true, data: order });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort("-createdAt");
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  if (req.user.role !== "admin" && order.user._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: "Not authorised to view this order" });
  }

  res.status(200).json({ success: true, data: order });
});

const markOrderPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  order.isPaid = true;
  order.paidAt = new Date();
  order.status = "confirmed";
  order.paymentResult = req.body.paymentResult || {};

  const updated = await order.save();
  res.status(200).json({ success: true, data: updated });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const validStatuses = ["pending", "confirmed", "processing", "delivered",];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found", });
  }

  order.status = status;

  if (status === "delivered") {
    order.isDelivered = true;
    order.deliveredAt = new Date();
  }

  const updatedOrder = await order.save();

  res.status(200).json({ success: true, data: updatedOrder, });
});


const getAllOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = status ? { status } : {};

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort("-createdAt")
      .skip(skip)
      .limit(limitNum)
      .populate("user", "name email"),
    Order.countDocuments(filter),
  ]);

  const revenue = await Order.aggregate([
    { $match: { ...filter, isPaid: true } },
    { $group: { _id: null, total: { $sum: "$totalPrice" } } },
  ]);

  res.status(200).json({
    success: true,
    data: orders,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    totalRevenue: revenue[0]?.total ?? 0,
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrder,
  markOrderPaid,
  updateOrderStatus,
  getAllOrders
}
