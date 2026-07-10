exports.regex=(keyword)=>{
    return {
        $regex:keyword,
        $options:"i"
    };
};