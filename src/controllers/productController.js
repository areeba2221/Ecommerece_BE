const Product = require("../models/ProductModels");
const asyncHandler = require("../middleware/asyncHandler");
const { deleteImage, extractPublicId } = require("../config/cloudinary");

const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = process.env.DEFAULT_PAGE_SIZE || 10,
    category,
    brand,
    minPrice,
    maxPrice,
    search,
    sortBy = "-createdAt",
    featured,
    inStock,
  } = req.query;

  const filter = { isActive: true };

  if (category) filter.category = { $regex: new RegExp(category, "i") };
  if (brand) filter.brand = { $regex: new RegExp(brand, "i") };
  if (featured === "true") filter.isFeatured = true;
  if (inStock === "true") filter.stock = { $gt: 0 };

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  if (search) filter.$text = { $search: search };

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sortBy)
      .skip(skip)
      .limit(limitNum)
      .select("-reviews"),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isActive: true,
  }).populate("reviews.user", "name");

  if (!product) {
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  }

  res.status(200).json({ success: true, data: product });
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    slug: req.params.slug,
    isActive: true,
  });

  if (!product) {
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  }

  res.status(200).json({ success: true, data: product });
});

const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    additionalInformation,
    price,
    comparePrice,
    category,
    brand,
    stock,
    sku,
    tags,
    attributes,
    isFeatured,
  } = req.body;

  if (!name || !description || price === undefined || !category) {
    return res.status(400).json({
      success: false,
      message: "name, description, price, and category are required",
    });
  }

  let images = [];

  if (req.files && req.files.length > 0) {
    images = req.files.map((file) => ({
      url: file.path,
      publicId: file.filename,
      altText: name,
    }));
  } else if (req.body.images) {
    images = Array.isArray(req.body.images)
      ? req.body.images
      : [req.body.images];
  }

  const parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
  const parsedAttributes =
    typeof attributes === "string" ? JSON.parse(attributes) : attributes;

  const product = await Product.create({
    name,
    description,
    additionalInformation,
    price: Number(price),
    comparePrice: comparePrice ? Number(comparePrice) : undefined,
    category,
    brand,
    images,
    stock: Number(stock) || 0,
    sku,
    tags: parsedTags,
    attributes: parsedAttributes,
    isFeatured: isFeatured === "true" || isFeatured === true,
    // createdBy:  req.user._id,
  });

  res.status(201).json({ success: true, data: product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const { reviews, ratings, ...updates } = req.body;

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  }

  if (req.files && req.files.length > 0) {
    await Promise.all(
      product.images
        .filter((img) => img.publicId)
        .map((img) => deleteImage(img.publicId)),
    );

    updates.images = req.files.map((file) => ({
      url: file.path,
      publicId: file.filename,
      altText: updates.name || product.name,
    }));
  }

  if (updates.price) updates.price = Number(updates.price);
  if (updates.comparePrice) updates.comparePrice = Number(updates.comparePrice);
  if (updates.stock) updates.stock = Number(updates.stock);
  if (typeof updates.tags === "string") updates.tags = JSON.parse(updates.tags);
  if (typeof updates.attributes === "string")
    updates.attributes = JSON.parse(updates.attributes);

  const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: updated });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  }

  await Promise.all(
    product.images
      .filter((img) => img.publicId)
      .map((img) => deleteImage(img.publicId)),
  );

  product.isActive = false;
  await product.save();

  res.status(200).json({ success: true, message: "Product removed" });
});

const deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  }

  const imageIndex = product.images.findIndex(
    (img) => img._id.toString() === req.params.imageId,
  );

  if (imageIndex === -1) {
    return res.status(404).json({ success: false, message: "Image not found" });
  }

  const [removed] = product.images.splice(imageIndex, 1);
  if (removed.publicId) await deleteImage(removed.publicId);

  await product.save();
  res
    .status(200)
    .json({ success: true, message: "Image deleted", data: product.images });
});

const addReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || !comment) {
    return res
      .status(400)
      .json({ success: false, message: "Rating and comment are required" });
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res
      .status(404)
      .json({ success: false, message: "Product not found" });
  }

  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user._id.toString(),
  );
  if (alreadyReviewed) {
    return res.status(400).json({
      success: false,
      message: "You have already reviewed this product",
    });
  }

  product.reviews.push({
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment,
  });
  product.recalcRatings();
  await product.save();

  res
    .status(201)
    .json({ success: true, message: "Review added", data: product.ratings });
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct("category", { isActive: true });
  res.status(200).json({ success: true, data: categories.sort() });
});
module.exports = {
  getProducts,
  getProduct,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  addReview,
  getCategories,
};
