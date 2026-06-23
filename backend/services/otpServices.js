const User=require("../models/User");
const AppError=require("../utils/appError");

function generateOtp(){
    return Math.floor(100000+Math.random()*900000).toString();
}

exports.sendOtp=async(phone)=>{
    const otp=generateOtp();
    let  user=await User.findOne({phone});
    if(!user){
        user=new User({phone});
    }
    user.otp=otp;
    user.otpExpires=Date.now()+10*60*1000;
    await user.save();

    console.log(`OTP for ${phone}: ${otp}`);
};

exports.verifyOtp=async(phone,otp)=>{
    const user=await User.findOne({phone});
    if(!user){
        throw new AppError("User not found",404);
    }
    if(user.otp!==otp || user.otpExpires<Date.now()){
        throw new AppError("Invalid or expired OTP",400);
    }
    user.isOtpVerified=true;
    user.otp=undefined;
    user.otpExpires=undefined;
    await user.save();
    return true;
};