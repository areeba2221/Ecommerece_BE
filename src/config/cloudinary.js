const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
    cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
    api_key : process.env.CLOUDINARY_API_KEY,
    api_secret : process.env.CLOUDINARY_API_SECRET_KEY
});

const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    allowed_formats: ["jpg", "jpeg", "png", "webp", "svg", "jfif"],
    transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto" }],
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    allowed_formats: ["jpg", "jpeg", "png", "webp", "svg", "jfif"],
    transformation: [{ width: 300, height: 300, crop: "fill", gravity: "face", quality: "auto" }],
  },
});

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpg, jpeg, png, webp, svg, jfif)"), false);
  }
};

const uploadProductImages = multer({
  storage: productStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }, 
});

const deleteImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`Cloudinary delete failed for ${publicId}:`, err.message);
  }
};

const extractPublicId = (url) => {
  try {
    const parts = url.split("/");
    const uploadIndex = parts.indexOf("upload");
    const startIndex = /^v\d+$/.test(parts[uploadIndex + 1])
      ? uploadIndex + 2
      : uploadIndex + 1;
    const withExt = parts.slice(startIndex).join("/");
    return withExt.replace(/\.[^/.]+$/, ""); 
  } catch {
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadProductImages,
  uploadAvatar,
  deleteImage,
  extractPublicId,
};
