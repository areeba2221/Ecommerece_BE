const express = require("express");
const router = express.Router();
const {
  createContactMessage,
  getAllContacts,
  updateContactStatus,
} = require("../controllers/contactController");

router.post("/", createContactMessage);
router.get("/", getAllContacts);
router.put("/:id/status", updateContactStatus);

module.exports = router;
