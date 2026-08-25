const mongoose = require("mongoose");

const Society = require("../models/Society");
const User = require("../models/User");
const Expense = require("../models/Expense");
const MaintenanceBill = require("../models/MaintenanceBill");
const CommunityFund = require("../models/CommunityFund");
const Contribution = require("../models/Contribution");

const notificationService = require("./notificationService");

const AppError = require("../utils/appError");
const { PERMISSIONS, has } = require("../config/permissions");

// =======================================================
// FINANCE
//
// One surface over what used to be three: maintenance bills, expenses
// and fund campaigns. The app treats them as one tab, and every screen
// in it mixes at least two — the maintenance hub shows expenses beside
// collection totals, the overview shows all three.
//
// The stored field names are the ones the rest of the backend already
// uses. Translation to what the app reads (targetAmount -> goal,
// collectedAmount -> raised) happens here, at the edge, rather than by
// migrating models that other code depends on.
// =======================================================

const asId = (v) => new mongoose.Types.ObjectId(String(v));

const canManage = (user) => has(user, PERMISSIONS.FINANCE_MANAGE);
const canVerify = (user) => has(user, PERMISSIONS.FINANCE_VERIFY);

const requireManage = (user) => {
  if (!canManage(user)) {
    throw new AppError("Only the committee can change finances.", 403);
  }
};

// "March 2026" — the label the bills are grouped by, and what the app
// prints on a receipt.
const monthLabel = (date = new Date()) =>
  date.toLocaleString("en-US", { month: "long", year: "numeric" });

const shapeFund = (fund) => {
  const goal = Number(fund.targetAmount || 0);
  const raised = Number(fund.collectedAmount || 0);

  return {
    _id: fund._id,
    id: fund._id,
    title: fund.title,
    description: fund.description || "",
    goal,
    raised,
    // Guard the divide: a fund with no target would otherwise report
    // Infinity, which renders as a progress bar off the screen.
    progress: goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0,
    status: fund.status,
    startDate: fund.startDate,
    endDate: fund.endDate,
  };
};

// =======================================================
// OVERVIEW
//
// The finance tab's landing card: what this resident owes, what the
// society holds, and what has happened lately.
// =======================================================

exports.getOverview = async (req) => {

  const societyId = asId(req.user.societyId);

  const [myBills, collected, spent, funds, recentContributions, recentExpenses] =
    await Promise.all([

      MaintenanceBill.find({ userId: req.user.id, status: "pending" })
        .select("amount")
        .lean(),

      MaintenanceBill.aggregate([
        { $match: { societyId, status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Expense.aggregate([
        { $match: { societyId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      CommunityFund.aggregate([
        { $match: { societyId } },
        { $group: { _id: null, total: { $sum: "$collectedAmount" } } },
      ]),

      Contribution.find({ societyId, status: "approved" })
        .populate("userId", "name")
        .populate("fundId", "title")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      Expense.find({ societyId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

    ]);

  const dueAmount = myBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const societyBalance =
    Number(collected[0]?.total || 0) +
    Number(funds[0]?.total || 0) -
    Number(spent[0]?.total || 0);

  // The app decides an activity's icon by looking for "paid" in the
  // title, so the wording here is load-bearing.
  const activities = [
    ...recentContributions.map((c) => ({
      title: `${c.userId?.name || "A resident"} paid to ${c.fundId?.title || "a fund"}`,
      time: c.createdAt,
      amount: c.amount,
    })),
    ...recentExpenses.map((e) => ({
      title: `Spent on ${e.title}`,
      time: e.createdAt,
      amount: e.amount,
    })),
  ]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 8);

  return {
    dueAmount,
    societyBalance,
    activities,
    canManage: canManage(req.user),
  };

};

// =======================================================
// MAINTENANCE
// =======================================================

exports.listMaintenance = async (req) => {

  // A resident sees their own bills; whoever runs the money sees the
  // society's. Same route, because the app calls it from both.
  const filter = canManage(req.user)
    ? { societyId: asId(req.user.societyId) }
    : { userId: req.user.id };

  return MaintenanceBill.find(filter)
    .populate("userId", "name flatNumber avatar")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

};

exports.setMaintenanceAmount = async (req) => {

  requireManage(req.user);

  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("Enter a valid monthly amount.", 400);
  }

  const set = { "maintenance.amount": amount };

  if (req.body.dueDay !== undefined) {
    const dueDay = Number(req.body.dueDay);

    // Capped at 28 so the due date exists in February too.
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      throw new AppError("The due day must be between 1 and 28.", 400);
    }

    set["maintenance.dueDay"] = dueDay;
  }

  const society = await Society.findByIdAndUpdate(
    req.user.societyId,
    { $set: set },
    { returnDocument: "after" }
  ).lean();

  if (!society) throw new AppError("Society not found.", 404);

  return society.maintenance;

};

exports.sendMaintenanceReminders = async (req) => {

  requireManage(req.user);

  const pending = await MaintenanceBill.find({
    societyId: asId(req.user.societyId),
    status: "pending",
  })
    .select("userId amount month")
    .lean();

  if (!pending.length) {
    return { reminded: 0, outstanding: 0 };
  }

  // One resident can owe for several months. Reminding them once per
  // bill would mean three notifications for the same debt.
  const userIds = [...new Set(pending.map((b) => String(b.userId)).filter(Boolean))];

  const owed = pending.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  // Delivery is best effort. A push that fails must not fail the
  // request and leave the treasurer thinking nothing was sent.
  let delivery = { created: 0 };

  try {
    delivery = await notificationService.notify({
      userIds,
      societyId: req.user.societyId,
      title: "Maintenance due",
      message: "You have maintenance outstanding. Open the app to settle it.",
      type: "maintenance",
    });
  } catch {
    // Fall through and report what was outstanding regardless.
  }

  return {
    reminded: userIds.length,
    outstanding: pending.length,
    outstandingAmount: owed,
    notified: delivery.created ?? 0,
  };

};

exports.getMaintenanceHub = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);
  const month = req.query.month || monthLabel();

  const [totals, bills, expenses, society] = await Promise.all([

    MaintenanceBill.aggregate([
      { $match: { societyId } },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
        },
      },
    ]),

    MaintenanceBill.find({ societyId, month })
      .populate("userId", "name flatNumber avatar")
      .sort({ status: 1 })
      .lean(),

    Expense.find({ societyId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),

    Society.findById(societyId).select("maintenance").lean(),

  ]);

  const byStatus = Object.fromEntries(totals.map((t) => [t._id, t.total]));

  return {
    month,
    amount: society?.maintenance?.amount || 0,
    dueDay: society?.maintenance?.dueDay || 10,

    totalCollected: Number(byStatus.paid || 0),
    totalPending: Number(byStatus.pending || 0),

    // The app reads flatNumber and status off each row, falling back to
    // the denormalised copy when the user was removed.
    residents: bills.map((b) => ({
      _id: b._id,
      name: b.userId?.name || "Resident",
      flatNumber: b.userId?.flatNumber || b.flatNumber || "—",
      amount: b.amount,
      status: b.status,
    })),

    expenses: expenses.map((e) => ({
      _id: e._id,
      label: e.title,
      category: e.category,
      amount: e.amount,
      date: e.createdAt,
    })),
  };

};

// =======================================================
// EXPENSES
// =======================================================

exports.listExpenses = async (req) => {

  const filter = { societyId: asId(req.user.societyId) };

  // A resident sees the books only once the committee publishes them.
  if (!canManage(req.user)) {
    filter.visibleToResidents = true;
  }

  return Expense.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

};

exports.createExpense = async (req) => {

  requireManage(req.user);

  const title = String(req.body.title || "").trim();
  const amount = Number(req.body.amount);

  if (!title) throw new AppError("Give the expense a title.", 400);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Enter a valid amount.", 400);
  }

  const allowed = ["maintenance", "electricity", "security", "other"];
  const category = allowed.includes(req.body.category)
    ? req.body.category
    : "other";

  return Expense.create({
    societyId: req.user.societyId,
    title,
    amount,
    category,
    description: req.body.description,
    // The app calls the field "receipt"; the model has always called it
    // billFile.
    billFile: req.body.receipt || req.body.billFile,
    createdBy: req.user.id,
    isPublished: true,
    visibleToResidents: true,
  });

};

exports.updateExpense = async (req) => {

  requireManage(req.user);

  const set = {};

  if (req.body.title !== undefined) set.title = String(req.body.title).trim();
  if (req.body.category !== undefined) set.category = req.body.category;
  if (req.body.description !== undefined) set.description = req.body.description;
  if (req.body.receipt !== undefined) set.billFile = req.body.receipt;
  if (req.body.visibleToResidents !== undefined) {
    set.visibleToResidents = Boolean(req.body.visibleToResidents);
  }

  if (req.body.amount !== undefined) {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Enter a valid amount.", 400);
    }
    set.amount = amount;
  }

  if (!Object.keys(set).length) throw new AppError("Nothing was changed.", 400);

  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, societyId: asId(req.user.societyId) },
    { $set: set },
    { returnDocument: "after" }
  ).lean();

  if (!expense) throw new AppError("Expense not found.", 404);

  return expense;

};

exports.deleteExpense = async (req) => {

  requireManage(req.user);

  const expense = await Expense.findOneAndDelete({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  }).lean();

  if (!expense) throw new AppError("Expense not found.", 404);

  return { removed: expense._id };

};

// =======================================================
// FUND CAMPAIGNS
// =======================================================

exports.listCampaigns = async (req) => {

  const funds = await CommunityFund.find({
    societyId: asId(req.user.societyId),
  })
    .sort({ createdAt: -1 })
    .lean();

  return funds.map(shapeFund);

};

exports.createCampaign = async (req) => {

  requireManage(req.user);

  const title = String(req.body.title || "").trim();
  const goal = Number(req.body.goal ?? req.body.targetAmount);

  if (!title) throw new AppError("Give the fund a title.", 400);

  if (!Number.isFinite(goal) || goal <= 0) {
    throw new AppError("Enter a valid goal amount.", 400);
  }

  const fund = await CommunityFund.create({
    societyId: req.user.societyId,
    title,
    description: String(req.body.description || "").trim(),
    targetAmount: goal,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    createdBy: req.user.id,
  });

  return shapeFund(fund.toObject());

};

exports.updateCampaign = async (req) => {

  requireManage(req.user);

  const set = {};

  if (req.body.title !== undefined) set.title = String(req.body.title).trim();
  if (req.body.description !== undefined) {
    set.description = String(req.body.description).trim();
  }
  if (req.body.status !== undefined) set.status = req.body.status;

  const goal = req.body.goal ?? req.body.targetAmount;
  if (goal !== undefined) {
    const value = Number(goal);
    if (!Number.isFinite(value) || value <= 0) {
      throw new AppError("Enter a valid goal amount.", 400);
    }
    set.targetAmount = value;
  }

  if (!Object.keys(set).length) throw new AppError("Nothing was changed.", 400);

  const fund = await CommunityFund.findOneAndUpdate(
    { _id: req.params.id, societyId: asId(req.user.societyId) },
    { $set: set },
    { returnDocument: "after" }
  ).lean();

  if (!fund) throw new AppError("Fund not found.", 404);

  return shapeFund(fund);

};

exports.deleteCampaign = async (req) => {

  requireManage(req.user);

  const fundId = req.params.id;
  const societyId = asId(req.user.societyId);

  // Money already came in against this fund. Deleting it would orphan
  // the contributions and quietly reduce what the society is shown to
  // hold, so it is refused rather than cascaded.
  const received = await Contribution.countDocuments({
    fundId,
    societyId,
    status: "approved",
  });

  if (received > 0) {
    throw new AppError(
      "Residents have already contributed to this fund. Close it instead of deleting it.",
      409
    );
  }

  const fund = await CommunityFund.findOneAndDelete({
    _id: fundId,
    societyId,
  }).lean();

  if (!fund) throw new AppError("Fund not found.", 404);

  await Contribution.deleteMany({ fundId, societyId });

  return { removed: fund._id };

};

// =======================================================
// CONTRIBUTIONS
// =======================================================

exports.listFundContributions = async (req) => {

  const societyId = asId(req.user.societyId);
  const fundId = req.params.fundId;

  const fund = await CommunityFund.findOne({ _id: fundId, societyId }).lean();

  if (!fund) throw new AppError("Fund not found.", 404);

  const rows = await Contribution.find({ fundId, societyId })
    .populate("userId", "name flatNumber avatar")
    .sort({ createdAt: -1 })
    .lean();

  const shape = (c) => ({
    _id: c._id,
    name: c.userId?.name || "Resident",
    flatNumber: c.userId?.flatNumber || "",
    avatar: c.userId?.avatar || null,
    amount: c.amount,
    status: c.status,
    receiptNo: c.receiptNo || undefined,
    date: c.createdAt,
    // Lets the app mark the resident's own row without shipping every
    // contributor's user id to every client.
    isMine: String(c.userId?._id || c.userId) === String(req.user.id),
  });

  const approved = rows.filter((c) => c.status === "approved");
  const pending = rows.filter((c) => c.status === "pending");

  return {
    fund: shapeFund(fund),
    contributors: approved.map(shape),
    // Only whoever verifies money needs the unverified queue.
    pending: canVerify(req.user) ? pending.map(shape) : [],
    pendingTotal: pending.reduce((sum, c) => sum + Number(c.amount || 0), 0),
    canManage: canVerify(req.user),
  };

};

exports.createContribution = async (req) => {

  const societyId = asId(req.user.societyId);
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Enter a valid amount.", 400);
  }

  const fundId = req.body.fundId || req.body.campaignId;

  const fund = fundId
    ? await CommunityFund.findOne({ _id: fundId, societyId }).lean()
    // The contribute screen posts without naming a fund, so it goes to
    // whichever campaign is currently open.
    : await CommunityFund.findOne({ societyId, status: "active" })
        .sort({ createdAt: -1 })
        .lean();

  if (!fund) throw new AppError("There is no open fund to contribute to.", 404);

  // A resident saying they have paid is a claim, not a confirmation.
  // The treasurer verifies it before it counts toward the total —
  // trusting the client here would let anyone inflate the fund.
  const contribution = await Contribution.create({
    societyId,
    fundId: fund._id,
    userId: req.user.id,
    amount,
    proof: req.body.proof,
    status: "pending",
  });

  return contribution.toObject();

};

exports.verifyContribution = async (req) => {

  if (!canVerify(req.user)) {
    throw new AppError("Only the treasurer can verify a payment.", 403);
  }

  const societyId = asId(req.user.societyId);

  const contribution = await Contribution.findOne({
    _id: req.params.id,
    societyId,
  });

  if (!contribution) throw new AppError("Contribution not found.", 404);

  if (contribution.status !== "pending") {
    throw new AppError("That contribution has already been settled.", 400);
  }

  const reject = req.body?.reject === true;

  const session = await mongoose.startSession();

  try {

    await session.withTransaction(async () => {

      if (!reject) {
        // The fund total and the contribution's status have to move
        // together, or a crash between them leaves the wall and the
        // total disagreeing about what was raised.
        await CommunityFund.updateOne(
          { _id: contribution.fundId, societyId },
          { $inc: { collectedAmount: contribution.amount } },
          { session }
        );

        contribution.receiptNo =
          `R-${Date.now().toString(36).toUpperCase()}-${String(contribution._id).slice(-4).toUpperCase()}`;
      }

      contribution.status = reject ? "rejected" : "approved";
      contribution.verifiedBy = req.user.id;
      contribution.verifiedAt = new Date();

      await contribution.save({ session });

    });

  } finally {
    await session.endSession();
  }

  return contribution.toObject();

};

exports.getContributionReceipt = async (req) => {

  const societyId = asId(req.user.societyId);

  const contribution = await Contribution.findOne({
    _id: req.params.id,
    societyId,
  })
    .populate("userId", "name flatNumber")
    .populate("fundId", "title")
    .lean();

  if (!contribution) throw new AppError("Contribution not found.", 404);

  const owner = String(contribution.userId?._id || contribution.userId);

  // A receipt names a resident and what they paid. Anyone may read
  // their own; the committee may read all of them.
  if (owner !== String(req.user.id) && !canVerify(req.user)) {
    throw new AppError("That receipt is not yours.", 403);
  }

  if (contribution.status !== "approved") {
    throw new AppError("That contribution has not been verified yet.", 409);
  }

  const society = await Society.findById(societyId).select("name address").lean();

  return {
    receiptNo: contribution.receiptNo,
    amount: contribution.amount,
    date: contribution.verifiedAt || contribution.createdAt,
    fund: contribution.fundId?.title || "Community fund",
    resident: {
      name: contribution.userId?.name || "Resident",
      flatNumber: contribution.userId?.flatNumber || "",
    },
    society: {
      name: society?.name || "",
      address: society?.address || "",
    },
  };

};

exports.listContributors = async (req) => {

  const rows = await Contribution.aggregate([
    {
      $match: {
        societyId: asId(req.user.societyId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$userId",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
        lastAt: { $max: "$createdAt" },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 100 },
  ]);

  if (!rows.length) return [];

  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } })
    .select("name flatNumber avatar")
    .lean();

  const byId = new Map(users.map((u) => [String(u._id), u]));

  return rows.map((r) => {
    const user = byId.get(String(r._id));
    return {
      _id: r._id,
      name: user?.name || "Resident",
      flatNumber: user?.flatNumber || "",
      avatar: user?.avatar || null,
      amount: r.total,
      count: r.count,
      date: r.lastAt,
    };
  });

};
