const logger = require("../utils/logger");
const mongoose=require("mongoose");
const onboardingRepository = require("../repository/onboardingRepository");
const societyService = require("./societyService");
const wingService = require("./wingServices");
const AppError = require("../utils/appError");


// =======================
// STEP 1: BASIC INFO
// =======================
exports.step1 = async (data, user) => {

    const {
        societyName,
        address,
        city,
        state,
        pincode
    } = data;

    let draft = await onboardingRepository.findDraftByUserId(user.id);

    const stepData = {
        societyName,
        address,
        city,
        state,
        pincode
    };

    if (!draft) {
        // Create new draft
        draft = await onboardingRepository.createDraft({
            createdBy: user.id,
            step: 1,
            data: stepData
        });
    } else {
        // Update existing draft
        draft = await onboardingRepository.updateDraft(draft._id, {
            step: 1,
            data: {
                ...draft.data,
                ...stepData
            }
        });
    }

    return draft;
};


// =======================
// STEP 2: STRUCTURE
// =======================
exports.step2 = async (data, user) => {

    const { draftId, structure } = data;

    // 🔍 Validate input
    if (!draftId) {
        throw new AppError("Draft ID is required", 400);
    }

    if (!structure || !Array.isArray(structure)) {
        throw new AppError("Invalid structure data", 400);
    }

    // 🔐 Fetch draft with ownership check
    const draft = await onboardingRepository.findDraftByIdAndUser(
        draftId,
        user.id
    );

    if (!draft) {
        throw new AppError("Draft not found or unauthorized", 404);
    }

    // 🔄 Update draft with structure
    const updatedDraft = await onboardingRepository.updateDraft(draftId, {
        step: 2,
        data: {
            ...draft.data,
            structure
        }
    });

    return updatedDraft;
};


//step 3 
exports.step3=async(data,user)=>{
    const {draftId,secretary}=data;
    if(!draftId)
    {
        throw new AppError("Draft ID is required",400);
    }
    if(!secretary)
    {
        throw new AppError("Secretary information is required",400);
    }
    const {name,email,phone,password} = secretary;
    if(!name || !email || !phone || !password)
    {
        throw new AppError("All secretary fietlds are required",400);
    }

    //get draft with ownership check
    const draft =await onboardingRepository.findDraftByIdAndUser(draftId,user.id);
    if(!draft)
    {
        throw new AppError("Draft not found or unauthorized",404);
    }

    //update draft with secretary info
    const updatedDraft = await onboardingRepository.updateDraft(draftId,{
        step:3,
        data:{
            ...draft.data,secretary
        }
    });
    return updatedDraft;
};

//step 4
exports.step4=async(data,user)=>{
    const {draftId,services}=data;
    if(!draftId)
    {
        throw new AppError("Draft ID is required",400);
    }
    if(!services || !Array.isArray(services))
    {
        throw new AppError("invalid services data",400);
    }

    const draft =await onboardingRepository.findDraftByIdAndUser(draftId,user.id);
    if(!draft)
    {
        throw new AppError("Draft not found or unauthorized",404);
    }

    const updateDraft = await onboardingRepository.updateDraft(draftId,{
        step:4,
        data:{
            ...draft.data,services
        }
    });
    return updateDraft;
};


//finalize onboarding
exports.finalizeOnboarding= async(data,user)=>{
    // const {draftId}=data;
    // if(!draftId)
    // {
    //     throw new AppError("Draft ID is required",400);
    // }

    // //get draft with ownership check
    // const draft = await onboardingRepository.findDraftByIdAndUser(draftId,user.id);
    // if(!draft)
    // {
    //     throw new AppError("Draft not found or unauthorized",404);
    // }
    // if(draft.status==="completed")
    // {
    //     throw new AppError("onboarding already finalized",400);
    // }
    // const d=draft.data;
    // //validate if all steps are completed
    // if(!d.societyName || !d.structure || !d.secretary || !d.services)
    // {
    //     throw new AppError("incomplete onboarding data",400);
    // }

    // //create society and secretary
    // const {society,secretary}= await societyService.createSociety({
    //     name:d.societyName,
    //     address:d.address,
    //     city:d.city,
    //     state:d.state,
    //     pincode:d.pincode,
    //     createdBy:user.id,
    //     secretary:d.secretary
    // });


    // //create wing (flats auto generated inside)
    // console.log(d.structure);
    // for(const wingData of d.structure)
    // {
    //     await wingService.createWing({
    //         societyId:society.id,
    //         name:wingData.wingName,
    //         totalFloors:wingData.totalFloors,
    //         flatsPerFloor:wingData.flatsPerFloor,
    //         createdBy:user.id
    //     });
    // }

    // //mark draft as completed
    // draft.status="completed";
    // await draft.save();

    // return{society,secretary};
    const session=await mongoose.startSession();
    session.startTransaction();
    try{
        const {draftId}=data;

        const draft = await onboardingRepository.findDraftByIdAndUser(draftId,user.id);
        if(!draft){
            throw new AppError("Draft not found or unauthorized",400);
        }
        if(draft.status==="completed")
        {
            throw new AppError("onboarding already completed",400);
        }
        const d=draft.data;
        logger.debug({ draftId: d?._id }, "onboarding draft");
        if (
            !d.societyName ||
            !d.structure ||
            !Array.isArray(d.structure) ||
            d.structure.length === 0 ||
            !d.secretary ||
            !d.secretary.name ||
            !d.secretary.email ||
            !d.secretary.phone ||
            !d.secretary.password
            ) 
            {
            throw new AppError("Incomplete onboarding data", 400);
            }

        //create society + secretary
        const {society,secretary}= await societyService.createSociety({
            name:d.societyName,
            address:d.address,
            city:d.city,
            state:d.state,
            pincode:d.pincode,
            createdBy:user.id,
            secretary:d.secretary,
        },session);

        //create wing +flats
        for(const wingData of d.structure)
        {
            //The Wing model calls this "name", and step2 stores the
            //structure with that key. Reading wingName here meant
            //createWing always received undefined and rejected the
            //whole finalize with "All fields are required" — so no
            //society could ever be onboarded. wingName is accepted as
            //a fallback for any client already sending it.
            await wingService.createWing({
                societyId:society.id,
                name:wingData.name || wingData.wingName,
                totalFloors:wingData.totalFloors,
                flatsPerFloor:wingData.flatsPerFloor,
                createdBy:user.id
            },session);
        }

        //mark draft as completed
        draft.status="completed";
        await draft.save({session})

        await session.commitTransaction();
        session.endSession();

        return {society,secretary};
    }catch(error)
    {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

// =======================
// DRAFTS
// =======================

exports.listDrafts = async (user) => {
    return onboardingRepository.findDraftsByUser(user.id);
};

exports.discardDraft = async (draftId, user) => {

    const deleted = await onboardingRepository.deleteDraftByIdAndUser(
        draftId,
        user.id
    );

    if (!deleted) {
        throw new AppError("Draft not found", 404);
    }

    return deleted;

};
