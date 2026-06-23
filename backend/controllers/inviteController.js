const Invite=require("../models/Invite");
const crypto=require("crypto");

exports.createInvite=async(req,res)=>{

    try{
        const {email,societyId,flatId,role} = req.body;
        const token=crypto.randomBytes(20).toString("hex");

        const newInvite=await Invite.create({
            email,
            societyId,
            flatId,
            role,
            token,
            expiresAt:Date.now()+24*60*60*1000
        });

        res.status(201).json({
            message: "Invite created successfully",
            invite: newInvite
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

//validate invite link

exports.validateInvite=async(req,res)=>{
    try{
        const invite=await Invite.findOne({token:req.params.token,used:false,expiresAt:{$gt:Date.now()}})
        if(!invite){
            return res.status(400).json({message:"Invalid or expired invite link"});
        }
        res.json({message:"Invite link is valid",invite});
    }
    catch(error){
        res.status(500).json({error:error.message});
    }
}