const express = require('express');
const { 
  getProducts, 
  getProduct, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getCategories 
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { uploadProductImages } = require('../config/cloudinary');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const router = express.Router();

router.route('/categories')
  .get(getCategories);

router.route('/')
  .get(getProducts)
  .post( upload.array('images', 5), createProduct);   

router.route('/:id')
  .get(getProduct)
  .put(protect, upload.array('images', 5), updateProduct)
  .delete(protect, deleteProduct);

module.exports = router;