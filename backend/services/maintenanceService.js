const logger = require("../utils/logger");
const repo = require("../repository/maintenanceRepository");
const User = require("../models/User");
const mongoose = require("mongoose");
const AppError = require("../utils/appError");


//  GENERATE MONTHLY BILL (ADMIN)
exports.generateBills = async (req) => {

  const { amount, dueDate, month } = req.body;

  const users = await User.find({
    societyId: req.user.societyId,
    societyRole: "member"
  });

  const bills = users.map(user => ({
    societyId: req.user.societyId,
    userId: user._id,
    flatNumber: user.flatNumber,
    amount,
    dueDate,
    month
  }));

  //Idempotent: the { societyId, userId, month } unique index rejects
  //bills that already exist, so re-running generation for a month tops
  //up any resident who was missed instead of double-billing everyone.
  //ordered:false lets the insert continue past the duplicates.
  const result = await repo.createMany(bills);

  return result;
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
  logger.info({ userId: bill.userId, billId: bill._id }, "maintenance reminder sent");

  return { message: "Reminder sent" };
};