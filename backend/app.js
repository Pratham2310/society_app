const express = require("express");
const cors = require("cors");
const app = express();

const authRoutes = require("./routes/authRoutes");
const inviteRoutes = require("./routes/inviteRoutes");
const societyRoutes = require("./routes/societyRoutes");
const errorHandler = require("./middleware/errorHandler");
const flatRoutes = require("./routes/flatRoutes");
const wingRoutes = require("./routes/wingRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const noticeRoutes = require("./routes/noticeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const onboardingRoutes = require("./routes/oboardingRoutes");
const salesRoutes = require("./routes/salesRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const eventRoutes = require("./routes/eventRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const communityFundRoutes = require("./routes/communityFundRoutes");
const parkingRoutes = require("./routes/parkingRoutes");
const securityRoutes = require("./routes/securityRoutes");
const mapRoutes = require("./routes/mapRoutes");
const helpRoutes = require("./routes/helpRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const guestPassRoutes = require("./routes/guestPassRoutes");
const gateLogRoutes = require("./routes/gateLogRoutes");
const visitorApprovalRoutes = require("./routes/visitorApprovalRoutes");
const AppError = require("./utils/appError");

app.use(express.json());
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);
// app.use("/api/invites", inviteRoutes);
app.use("/api/societies", societyRoutes);
app.use("/api/flats", flatRoutes);
app.use("/api/wings", wingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/residents/dashboard", dashboardRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/community-funds", communityFundRoutes);
app.use("/api/parking", parkingRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/map", mapRoutes);
app.use("/api/help", helpRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/guest-passes",guestPassRoutes);
app.use("/api/gate-log",gateLogRoutes);
app.use("/api/visitor-approvals",visitorApprovalRoutes);

// Home Route
app.get("/", (req, res) => {
  res.send("Welcome to society app backend");
});

// 404 Handler
app.use((req, res, next) => {
  next(
    new AppError(
      `Can't find ${req.originalUrl} on this server!`,
      404
    )
  );
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;