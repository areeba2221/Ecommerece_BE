const ProductModels = require("../models/ProductModels");

// Create Product
const createProduct = async (req, res) => {
    try {
        const {
            name,
            image,
            category,
            subCategory,
            unit,
            stock,
            price,
            discount,
            description,
            more_details,
            publish
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: Product name is required."
            });
        }

        const newProduct = new ProductModels({
            name,
            image: image || [],
            category: category || [],
            subCategory: subCategory || [],
            unit,
            stock,
            price,
            discount,
            description,
            more_details: more_details || {},
            publish: publish !== undefined ? publish : true
        });

        const savedProduct = await newProduct.save();

        return res.status(201).json({
            success: true,
            message: "Product created successfully inside database.",
            data: savedProduct
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Processing Error.",
            error: error.message
        });
    }
};

// Get All Products
const getAllProducts = async (req, res) => {
  try {
    const products = await ProductModels.find()
      .populate("category")
      .populate("subCategory");

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Single Product
const getSingleProduct = async (req, res) => {
  try {
    const product = await ProductModels.findById(req.params.id)
      .populate("category")
      .populate("subCategory");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product Not Found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Product
const updateProduct = async (req, res) => {
  try {
    const product = await ProductModels.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product Not Found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product Updated Successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Product
const deleteProduct = async (req, res) => {
  try {
    const product = await ProductModels.findByIdAndDelete(
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product Not Found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product Deleted Successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
module.exports = {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
};