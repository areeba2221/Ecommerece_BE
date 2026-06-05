const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name : {
        type : String,
        required : [true, "Provide name"]
    },
    email : {
        type : String,
        required : [true, "Provide email"]
    },
    password : {
        type : String,
        required : [true, "Provide password"]
    },
    avater : {
        type : String,
        default : ""
    },
    mobile : {
        type : Number,
        default : null
    },
    refresh_token : {
        type : String,
        default : ""
    },
    verify_email : {
        type : Boolean,
        default : false
    },

},  {
    timestamps : true
})

const UserModels = mongoose.model('user', userSchema)

module.exports = UserModels