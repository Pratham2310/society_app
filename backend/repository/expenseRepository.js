const Expense= require("../models/Expense.js");

//create
exports.create=(data)=>Expense.create(data);

//get all
exports.findAll=(filter)=>Expense.find(filter).sort({createdAt:-1}).lean();

//get one

exports.findById=(id)=>Expense.findById(id);

//update
exports.findByIdAndUpdate=(id,data)=>Expense.findByIdAndUpdate(id,data,{new:true});