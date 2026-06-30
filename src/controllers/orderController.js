const Order = require("../models/OrderModels");
const Product = require("../models/ProductModels");
const User = require("../models/UserModel");
const asyncHandler = require("../middleware/asyncHandler");
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const clearUserCart = async (userId) => {
  if (!userId) return;

  await User.findByIdAndUpdate(
    userId,
    { $set: { cart: [] } },
    { new: true },
  );
};

//add stripe payment method
const createStripeSection = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No items provided" });
  }
  //get db product
  const productIds = items.map((item) => item.product);

  const dbProducts = await Product.find({
    _id: { $in: productIds },
    isActive: true,
  });

  const line_items = [];

  for (const item of items) {
    const product = dbProducts.find((p) => p._id.toString() === item.product);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    line_items.push({
      price_data: {
        currency: "usd",
        product_data: { name: product.name },
        unit_amount: Math.round(product.price * 100),
      },
      quantity: item.quantity,
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items,
    success_url: `${process.env.ORIGIN}/order-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.ORIGIN}/checkout`,

    metadata: {
      userId: req.user._id.toString(),

      items: JSON.stringify(req.body.items),

      orderData: JSON.stringify({
        shippingAddress: req.body.shippingAddress,
        paymentMethods: "stripe",
        notes: req.body.notes,
      }),
    },
  });

  res.status(200).json({ success: true, url: session.url });
});

//create webhook function
const stripeWebhook = async (req, res) => {
  console.log("Webhook Hit");

  let event;

  try {
    const signature = req.headers["stripe-signature"];

    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.log("Webhook Error:", err.message);

    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const items = JSON.parse(session.metadata.items);
    const orderData = JSON.parse(session.metadata.orderData);

    const productIds = items.map((item) => item.product);
    const dbProducts = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    });
    
    const orderItems = [];

    for (const item of items) {
      const product = dbProducts.find((p) => p._id.toString() === item.product);
      if (!product) continue;
      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.images?.[0]?.url || "",
      });
    }
    
    const itemsPrice = orderItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0,
    );
    const shippingPrice = itemsPrice > 5000 ? 0 : 200;
    const taxRate = 0.05;
    const taxPrice = Math.round(itemsPrice * taxRate);
    const totalPrice = itemsPrice + shippingPrice + taxPrice;

    const order = await Order.create({
      user: userId,
      orderItems,
      shippingAddress: orderData.shippingAddress,
      paymentMethods: "stripe",
      itemsPrice,
      shippingPrice,
      taxPrice,
      totalPrice,
      isPaid: true,
      paidAt: new Date(),
      status: "confirmed",
      paymentResult: {
        id: session.payment_intent,
        status: session.payment_status,
      },
    });

    await Promise.all(
      orderItems.map((item) =>
        Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity },
        }),
      ),
    );
    
    await clearUserCart(userId);

    console.log("order created successfully:", order._id);

  }
  res.status(200).json({ received: true });
};

const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethods, notes } = req.body;

  if (!items || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No order items provided" });
  }
  if (!shippingAddress) {
    return res
      .status(400)
      .json({ success: false, message: "Shipping address is required" });
  }
  if (!paymentMethods) {
    return res
      .status(400)
      .json({ success: false, message: "Payment method is required" });
  }

  const productIds = items.map((i) => i.product);
  const dbProducts = await Product.find({
    _id: { $in: productIds },
    isActive: true,
  });

  const orderItems = [];
  for (const item of items) {
    const product = dbProducts.find((p) => p._id.toString() === item.product);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: `Product ${item.product} not found` });
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

  const itemsPrice = orderItems.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0,
  );
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
      Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      }),
    ),
  );

  // make the cart empty
  await clearUserCart(req.user._id);

  res.status(201).json({ success: true, data: order });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort("-createdAt");
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email",
  );

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  if (
    req.user.role !== "admin" &&
    order.user._id.toString() !== req.user._id.toString()
  ) {
    return res
      .status(403)
      .json({ success: false, message: "Not authorised to view this order" });
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

  const validStatuses = ["pending", "confirmed", "processing", "delivered"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  order.status = status;

  if (status === "delivered") {
    order.isDelivered = true;
    order.deliveredAt = new Date();
  }

  const updatedOrder = await order.save();

  res.status(200).json({ success: true, data: updatedOrder });
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
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
    totalRevenue: revenue[0]?.total ?? 0,
  });
});

module.exports = {
  createStripeSection,
  stripeWebhook,
  createOrder,
  getMyOrders,
  getOrder,
  markOrderPaid,
  updateOrderStatus,
  getAllOrders,
};
