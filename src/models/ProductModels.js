const mongoose = require("mongoose");

const productSchema = new mongoose.Schema ({
    name : {
        type : String,
        required: [true, "Product name is required"]
    },
    image : {
        type : Array,
        default : []
    },
    category : [
        {
            type : mongoose.Schema.Types.ObjectId, 
            ref : 'Category' 
        }
    ],
    subCategory : [
        {
            type : mongoose.Schema.Types.ObjectId, 
            ref : 'SubCategory' 
        }
    ],
    unit : {
        type : String,
        default : ""
    },
    stock : {
        type : Number,
        default : null
    },
    price : {
        type : Number,
        default : null
    },
    discount : {
        type : Number,
        default : null
    },
    description : {
        type : String,
        default : ""
    },
    more_details : {
        type : Object,
        default : {}
    },
    publish : {
        type : Boolean,
        default : true
    },

}, {
    timestamps : true
})

const ProductModels = mongoose.model('Product', productSchema)

module.exports = ProductModels;
