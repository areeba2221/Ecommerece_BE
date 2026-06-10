const Product = require('../models/ProductModels');
const cloudinary = require('../config/cloudinary');
const { deleteImage } = require('../config/cloudinary');

const getProducts = async (req, res) => {
  try {
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

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined && minPrice !== "") filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined && maxPrice !== "") filter.price.$lte = Number(maxPrice);
    }

    if (search) filter.$text = { $search: search };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isActive: true })
      .populate("reviews.user", "name");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct("category", { isActive: true });
    res.status(200).json({ success: true, data: categories.sort() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      name, description, price, comparePrice, category, brand,
      stock, sku, tags, attributes, isFeatured
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
    }

    const parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
    const parsedAttributes = typeof attributes === "string" ? JSON.parse(attributes) : attributes;

    const product = await Product.create({
      name, description,
      price: Number(price),
      comparePrice: comparePrice !== undefined && comparePrice !== null ? Number(comparePrice) : undefined,
      category, brand,
      images,
      stock: stock !== undefined && stock !== null ? Number(stock) : 0,
      sku,
      tags: parsedTags,
      attributes: parsedAttributes,
      isFeatured: isFeatured === "true" || isFeatured === true,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { reviews, ratings, ...updates } = req.body;
    const product = await Product.findOne({ _id: req.params.id, isActive: true });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (req.files && req.files.length > 0) {
      await Promise.all(
        (product.images || [])
          .filter((img) => img?.publicId)
          .map((img) => deleteImage(img.publicId))
      );
      updates.images = req.files.map((file) => ({
        url: file.path,
        publicId: file.filename,
        altText: updates.name || product.name,
      }));
    }

    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.comparePrice !== undefined) updates.comparePrice = Number(updates.comparePrice);
    if (updates.stock !== undefined) updates.stock = Number(updates.stock);
    if (typeof updates.tags === "string") updates.tags = JSON.parse(updates.tags);
    if (typeof updates.attributes === "string") updates.attributes = JSON.parse(updates.attributes);
    if (updates.isFeatured !== undefined) {
      updates.isFeatured = updates.isFeatured === "true" || updates.isFeatured === true;
    }

    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isActive: true });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await Promise.all(
      (product.images || [])
        .filter((img) => img?.publicId)
        .map((img) => deleteImage(img.publicId))
    );

    product.isActive = false;
    await product.save();

    res.status(200).json({ success: true, message: "Product removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getProduct,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
};
