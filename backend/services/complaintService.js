const complaintRepo=require("../repository/complaintRepository");
const mongoose=require("mongoose");
const AppError=require("../utils/appError");

//create
exports.createComplaint = async(Req)=>{
    const ticketId="TKT-"+Math.floor(1000+math.random()*9000);

    const complaint=await complaintRepo.Create({
        ...req.body,
        ticketId,
        societyId:new mongoose.Types.ObjectId(req.user.societyId),
        userId:req.user.id,
        flatNumber:req.user.flatNumber,

        timeline:[
            {
                status:"pending",
                message:"Complaint registered",
                updateBy:"System"
            }
        ]
    });
}

//get list(filter+role)
exports.getComplaints=async(req)=>{
    const {status}=req.query;
    const isAdmin=[
        "chairman",
        "secretary",
        "treasurer",
        "comitee=member"
    ].includes(req.user.societyRole);

    let filter = {
        societyId: new mongoose.Types.ObjectId(req.user.societyId)
    };

    if (!isAdmin) {
        filter.userId = req.user.id;
    }

    if (status) {
        filter.status = status;
    }

    const complaints = await complaintRepo.findAll(filter);

    // 🔥 UI CARD RESPONSE
    return complaints.map(c => ({
        _id: c._id,
        title: c.title,
        category: c.category,
        status: c.status,
        isUrgent: c.isUrgent,
        image: c.image,
        flatNumber: c.flatNumber,
        createdAt: c.createdAt
    }));
};


// 🔥 GET SINGLE (DETAIL PAGE)
exports.getComplaintById = async (id, req) => {

    const complaint = await complaintRepo.findById(id);

    if (!complaint) throw new AppError("Complaint not found", 404);

    if (complaint.societyId.toString() !== req.user.societyId) {
        throw new AppError("Access denied", 403);
    }

    return complaint;
};


// 🔥 UPDATE STATUS (ADMIN)
exports.updateStatus = async (id, status, req) => {

    const isAdmin = [
        "secretary",
        "chairman",
        "treasurer",
        "committee_member"
    ].includes(req.user.societyRole);

    if (!isAdmin) throw new AppError("Not authorized", 403);

    const complaint = await complaintRepo.findById(id);

    if (!complaint) throw new AppError("Complaint not found", 404);

    complaint.timeline.push({
        status,
        message: `Status changed to ${status}`,
        updatedBy: req.user.societyRole
    });

    complaint.status = status;

    if (status === "resolved") {
        complaint.resolvedAt = new Date();
    }

    await complaint.save();

    return complaint;
};
