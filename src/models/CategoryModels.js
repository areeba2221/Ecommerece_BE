const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema ({
    name : {
        type : String,
        default : ""
    },
    image : {
        type : String,
        default : ""
    },

}, {
    timestamps : true
})

const CategoryModels = mongoose.model('category', categorySchema)

module.exports = CategoryModels