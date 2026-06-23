const communityFund=require("../models/CommunityFund");
const contribution=require("../models/Contribution");

//fund
exports.createFund=(data)=>communityFund.create(data);
exports.findFunds=(filter)=>communityFund.find(filter).lean();
exports.findById=(id)=>communityFund.findById(id);
exports.updateFund=(id,data)=>communityFund.findByIdAndUpdate(id,data,{new:true});
exports.deleteFund=(id)=>communityFund.findByIdAndDelete(id);

//contribution
exports.createContribution=(data)=>contribution.create(data);
exports.findContributions=(filter)=>contribution.find(filter).lean();
exports.findContributionById=(id)=>contribution.findById(id).lean();
exports.updateContribution=(id,data)=>contribution.findByIdAndUpdate(id,data,{new:true});
exports.deleteContribution=(id)=>contribution.findByIdAndDelete(id);