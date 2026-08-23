const onboardingService=require("../services/onboardingService");

//export step1
exports.step1=async(req,res)=>{
    try{
        const draft= await onboardingService.step1(req.body,req.user);
        res.status(200).json({message:"step 1 saved successfully",data:draft});
    } catch (error) {
        res.status(error.statusCode || 500).json({message:error.message});
    }
};


//step 2
exports.step2=async(req,res)=>{
    try{
        const draft=await onboardingService.step2(req.body,req.user);
        res.status(200).json({message:"step 2 saved successfully",data:draft});
    } catch (error) {
        res.status(error.statusCode || 500).json({message:error.message});
    }
}

//step 3
exports.step3=async(req,res)=>{
    try{
        const draft = await onboardingService.step3(req.body,req.user);
        res.status(200).json({message:"step 3 saved successfully",data:draft});
    }catch(error)
    {
        res.status(error.statusCode || 500).json({message:error.message});  
    }
};

//step 4
exports.step4=async(req,res)=>{
    try{
        const draft = await onboardingService.step4(req.body,req.user);
        res.status(200).json({message:"step 4 saved successfully",data:draft});
    } catch (error) {
        res.status(error.statusCode || 500).json({message:error.message});
    }
};

exports.finalize=async(req,res)=>{
    try{
        const result = await onboardingService.finalizeOnboarding(req.body,req.user);
        res.status(200).json({message:"Onboarding finalized successfully",data:result});
    }catch(error)
    {
        res.status(error.statusCode || 500).json({message:error.message});
    }
};

// LIST DRAFTS
exports.listDrafts = async (req, res, next) => {
  try {
    const drafts = await onboardingService.listDrafts(req.user);
    res.json({ message: "Drafts fetched successfully", data: drafts });
  } catch (err) {
    next(err);
  }
};

// DISCARD A DRAFT
exports.discardDraft = async (req, res, next) => {
  try {
    await onboardingService.discardDraft(req.params.draftId, req.user);
    res.json({ message: "Draft discarded", data: null });
  } catch (err) {
    next(err);
  }
};
