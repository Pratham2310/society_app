const Event =require("../models/Events");

exports.createEvent=(data)=>Event.create(data);

exports.findAll=(filter,limit)=>{
    return Event.find(filter)
    .sort({eventDate:-1})
    .limit(limit)
    .lean();
};

exports.findById=(id)=>Event.findById(id).lean();

exports.updateEvent=(id,data)=>{
    Event.findByIdAndUpdate(id,data,{new:true});
};

exports.deleteEvent=(id)=>Event.findByIdAndDelete(id);