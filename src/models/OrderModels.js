const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product:  { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name:     { type: String, required: true },  
    price:    { type: Number, required: true },   
    quantity: { type: Number, required: true, min: 1 },
    image:    { type: String, default: "" },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    street:  { type: String, required: true },
    city:    { type: String, required: true },
    state:   { type: String, required: true },
    zip:     { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderItems: {
      type: [orderItemSchema],
      validate: [(arr) => arr.length > 0, "Order must have at least one item"],
    },
    shippingAddress: { type: shippingAddressSchema, required: true },

    paymentMethod: {
      type: String,
      required: true,
      enum: ["cod", "bank_transfer"],
    },
    paymentResult: {
      id:         String,
      status:     String,
      updateTime: String,
      email:      String,
    },
    isPaid:   { type: Boolean, default: false },
    paidAt:   Date,

    itemsPrice:    { type: Number, required: true, min: 0 },
    shippingPrice: { type: Number, required: true, min: 0, default: 0 },
    taxPrice:      { type: Number, required: true, min: 0, default: 0 },
    totalPrice:    { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
    },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: Date,

    trackingNumber: { type: String, trim: true },
    notes: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

orderSchema.virtual("itemCount").get(function () {
  return this.orderItems.reduce((sum, item) => sum + item.quantity, 0);
});

module.exports = mongoose.model("Order", orderSchema);
