const User = require("../models/User");
const Notice = require("../models/Notice");
const Event = require("../models/Events");
const Complaint = require("../models/Complaint");
const Maintenance = require("../models/MaintenanceBill");
const Expense = require("../models/Expense");
const Fund = require("../models/CommunityFund");

const mongoose = require("mongoose");

exports.getDashboard = async (req) => {

  const societyId = new mongoose.Types.ObjectId(req.user.societyId);

  const isAdmin = [
    "secretary",
    "chairman",
    "treasurer",
    "committee_member"
  ].includes(req.user.societyRole);

  // 🔥 PARALLEL CALLS
  const [
    user,
    urgentNotice,
    announcements,
    upcomingEvent,
    myComplaints,
    myBills
  ] = await Promise.all([

    User.findById(req.user.id)
      .populate("flatId")
      .populate("wingId")
      .lean(),

    Notice.findOne({
      societyId,
      isUrgent: true,
      status: "published"
    }).sort({ createdAt: -1 }).lean(),

    Notice.find({
      societyId,
      type: "announcement",
      status: "published"
    }).sort({ createdAt: -1 }).limit(3).lean(),

    // 🔥 FIXED → only future events
    Event.findOne({
      societyId,
      eventDate: { $gte: new Date() }
    }).sort({ eventDate: 1 }).lean(),

    Complaint.find({
      userId: req.user.id
    }).sort({ createdAt: -1 }).limit(3).lean(),

    Maintenance.find({
      userId: req.user.id
    }).sort({ createdAt: -1 }).limit(3).lean()
  ]);

  if (!user) throw new Error("User not found");

  // 🔥 BASE RESPONSE (RESIDENT + SECRETARY)
  let response = {
    user: {
      name: user.name,
      flat: user.flatId?.flatNumber || user.flatNumber || "",
      wing: user.wingId?.name || "",
      profilePicture: user.profilePicture
    },
    urgentNotice,
    announcements,

    upcomingEvent: upcomingEvent
      ? {
          _id: upcomingEvent._id,
          title: upcomingEvent.title,
          eventDate: upcomingEvent.eventDate
            ? upcomingEvent.eventDate.toISOString().split("T")[0]
            : null,
          time: upcomingEvent.time,
          location: upcomingEvent.location
        }
      : null,

    myComplaints,
    myBills
  };

  // 🔥 SECRETARY DASHBOARD ADDITION
  if (isAdmin) {

    const [
      maintenanceStats,
      expenseStats,
      fundStats,
      pendingComplaints
    ] = await Promise.all([

      Maintenance.aggregate([
        { $match: { societyId } },
        {
          $group: {
            _id: null,
            totalCollected: {
              $sum: {
                $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0]
              }
            },
            totalPending: {
              $sum: {
                $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0]
              }
            }
          }
        }
      ]),

      Expense.aggregate([
        { $match: { societyId } },
        {
          $group: {
            _id: null,
            totalExpense: { $sum: "$amount" }
          }
        }
      ]),

      Fund.aggregate([
        { $match: { societyId } },
        {
          $group: {
            _id: null,
            totalFunds: { $sum: "$collectedAmount" }
          }
        }
      ]),

      Complaint.countDocuments({
        societyId,
        status: { $ne: "resolved" }
      })
    ]);

    response = {
      ...response,

      maintenanceStats: maintenanceStats[0] || {
        totalCollected: 0,
        totalPending: 0
      },

      expenseStats: expenseStats[0] || {
        totalExpense: 0
      },

      fundStats: fundStats[0] || {
        totalFunds: 0
      },

      pendingComplaints
    };
  }

  return response;
};