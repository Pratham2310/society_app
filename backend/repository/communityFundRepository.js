const communityFund=require("../models/CommunityFund");
const contribution=require("../models/Contribution");

//fund
exports.createFund=(data)=>communityFund.create(data);
exports.findFunds=(filter)=>communityFund.find(filter).lean();
exports.findById=(id)=>communityFund.findById(id);
exports.updateFund=(id,data,session=null)=>
  communityFund.findByIdAndUpdate(id,data,{new:true,...(session?{session}:{})});

//Atomic increment so two concurrent approvals cannot both read the
//same collectedAmount and overwrite each other's addition.
exports.incrementCollected=(id,amount,session=null)=>
  communityFund.findByIdAndUpdate(
    id,
    {$inc:{collectedAmount:amount}},
    {new:true,...(session?{session}:{})}
  );
exports.deleteFund=(id)=>communityFund.findByIdAndDelete(id);

//contribution
exports.createContribution=(data)=>contribution.create(data);
exports.findContributions=(filter)=>contribution.find(filter).lean();
exports.findContributionById=(id)=>contribution.findById(id).lean();
exports.updateContribution=(id,data,session=null)=>
  contribution.findByIdAndUpdate(id,data,{new:true,...(session?{session}:{})});
exports.deleteContribution=(id)=>contribution.findByIdAndDelete(id);