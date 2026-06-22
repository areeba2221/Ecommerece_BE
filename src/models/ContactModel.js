const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true
        },
        phone: String,
        subject: String,
        message: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["Pending", "InProgress", "Resolved"],
            default: "Pending",
        },
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("contact", contactSchema);