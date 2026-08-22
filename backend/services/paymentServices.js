const paymentRepo =
  require("../repository/paymentRepository");

const maintenanceRepo =
  require("../repository/maintenanceRepository");

const AppError =
  require("../utils/appError");

const { withTransaction } =
  require("../utils/transactionHelper");


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

    //Recording the payment and marking the bill paid must be
    //atomic. Without this, a failure between the two leaves an
    //orphaned payment against a bill that still reads "pending" —
    //money taken, dues still owed.
    return withTransaction(async (session) => {

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
      }, session);

    await maintenanceRepo.update(
      bill._id,
      {
        status: "paid",
        paidAt: new Date(),
        paymentId: payment._id,
      },
      session
    );

      return payment;

    });
};