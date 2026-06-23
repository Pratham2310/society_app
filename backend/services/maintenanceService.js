const repo = require("../repository/maintenanceRepository");
const User = require("../models/User");
const mongoose = require("mongoose");
const AppError = require("../utils/appError");


//  GENERATE MONTHLY BILL (ADMIN)
exports.generateBills = async (req) => {

  const { amount, dueDate, month } = req.body;

  const users = await User.find({
    societyId: req.user.societyId,
    societyrole: "member"
  });

  const bills = users.map(user => ({
    societyId: req.user.societyId,
    userId: user._id,
    flatNumber: user.flatNumber,
    amount,
    dueDate,
    month
  }));

  return await repo.createMany(bills);
};


//  GET MY DUES (RESIDENT)
exports.getMyBills = async (req) => {

  return await repo.findAll({
    userId: new mongoose.Types.ObjectId(req.user.id)
  });
};


//  ADMIN VIEW (ALL USERS)
exports.getAllBills = async (req) => {

  return await repo.findAll({
    societyId: new mongoose.Types.ObjectId(req.user.societyId)
  });
};


//  MARK AS PAID (ADMIN)
exports.markAsPaid = async (id, req) => {

  const bill = await repo.findById(id);

  if (!bill) throw new AppError("Bill not found", 404);

  bill.status = "paid";
  bill.paidAt = new Date();

  await bill.save();

  return bill;
};


//  SET AS PENDING
exports.markPending = async (id) => {

  return await repo.update(id, {
    status: "pending",
    paidAt: null
  });
};


//  REMINDER (just log for now)
exports.sendReminder = async (id) => {

  const bill = await repo.findById(id);

  if (!bill) throw new AppError("Bill not found", 404);

  // later → notification / whatsapp
  console.log("Reminder sent to:", bill.userId);

  return { message: "Reminder sent" };
};