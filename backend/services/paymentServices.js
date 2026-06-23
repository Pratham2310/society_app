const paymentRepo =
  require("../repository/paymentRepository");

const maintenanceRepo =
  require("../repository/maintenanceRepository");

const AppError =
  require("../utils/appError");


// ===================================
// RECORD OFFLINE MAINTENANCE PAYMENT
// ===================================
exports.recordMaintenancePayment =
  async (billId, req) => {

    const bill =
      await maintenanceRepo.findById(
        billId
      );

    if (!bill) {
      throw new AppError(
        "Maintenance bill not found",
        404
      );
    }

    if (bill.status === "paid") {
      throw new AppError(
        "Bill already paid",
        400
      );
    }

    const payment =
      await paymentRepo.create({

        societyId:
          bill.societyId,

        userId:
          bill.userId,

        maintenanceBillId:
          bill._id,

        amount:
          bill.amount,

        paymentType:
          "maintenance",

        paymentMethod:
          req.body.paymentMethod,

        referenceNumber:
          req.body.referenceNumber,

        notes:
          req.body.notes,

        recordedBy:
          req.user.id,

        status:
          "success"
      });

    bill.status = "paid";

    bill.paidAt = new Date();

    bill.paymentId =
      payment._id;

    await bill.save();

    return payment;
};