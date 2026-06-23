const express=require("express");
const router=express.Router();

const upload=require("../middleware/upload");
router.post("/upload",upload.single("file"),(req,res)=>{
    res.json({
        success:true,
        fileUrl:req.file.path
    });
});
module.exports=router;