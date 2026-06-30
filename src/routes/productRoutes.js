const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProduct,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  addReview,
  getCategories,
} = require("../controllers/productController");
const { protect, authorise } = require("../middleware/auth");
const { uploadProductImages } = require("../config/cloudinary");

const handleUpload = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (!err) return next();
    const status =
      err.code === "LIMIT_FILE_SIZE"
        ? 413
        : err.code === "LIMIT_FILE_COUNT"
          ? 400
          : 400;
    return res.status(status).json({ success: false, message: err.message });
  });
};

router.get("/", getProducts);
router.get("/categories", getCategories);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id", getProduct);

router.post("/:id/reviews", protect, addReview);

router.post(
  "/",
  handleUpload(uploadProductImages.array("images", 5)),
  createProduct,
);

router.put(
  "/:id",
  handleUpload(uploadProductImages.array("images", 5)),
  updateProduct,
);

router.delete("/:id", protect, authorise("admin"), deleteProduct);
router.delete(
  "/:id/images/:imageId",
  protect,
  authorise("admin"),
  deleteProductImage,
);

module.exports = router;
