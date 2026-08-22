const paymentService =require("../services/paymentServices");
const audit = require("../services/auditService");
const {
  recordPaymentSchema
} = require("../validation/paymentValidation");

exports.recordMaintenancePayment =
  async (req, res, next) => {

    try {

      const { error } =
        recordPaymentSchema.validate(
          req.body
        );

      if (error) {

        return res.status(400).json({
          success: false,
          message:
            error.details[0].message
        });

      }

      const data =
        await paymentService
          .recordMaintenancePayment(
            req.params.billId,
            req
          );

      await audit.record(req.user, audit.ACTIONS.PAYMENT_RECORDED, {
        targetType: "MaintenanceBill",
        targetId: req.params.billId,
        metadata: {
          amount: data?.amount,
          paymentMethod: req.body.paymentMethod,
          referenceNumber: req.body.referenceNumber,
          paymentId: data?._id,
        },
        req,
      });

      res.status(201).json({
        success: true,
        data
      });

    } catch (err) {
      next(err);
    }

};