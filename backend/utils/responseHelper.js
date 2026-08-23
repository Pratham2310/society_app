//=======================
//success helper
//=======================
exports.successhelper=(res,statusCode=200,message="Success",data=null)=>{
    return res.status(statusCode).json({
        success:true,
        message,
        data,
    });
};


//================================
//error response
//================================
exports.errorhelper=(res,statusCode=500,message="Internal server error",data=null)=>{
    return res.status(statusCode).json({
        success:false,
        message,
        data,
    });
};

//================================
//unified response
//used by controllers as:
//sendResponse(res, statusCode, success, message, data)
//================================
exports.sendResponse=(res,statusCode=200,success=true,message="Success",data=null)=>{
    return res.status(statusCode).json({
        success,
        message,
        data,
    });
};
