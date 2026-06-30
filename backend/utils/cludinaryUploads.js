const cloudinary = require("../config/cloudinary");
const cludinary=require("../config/cloudinary");

exports.uploadBase64=async(base64,folder)=>{
    const result=await cloudinary.uploader.upload(base64,{folder});
    return result.secure_url;
}