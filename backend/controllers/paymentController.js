const paymentService =require("../services/paymentServices");
const {
  recordPaymentSchema
} = require("../validation/paymentVallidation");

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

      res.status(201).json({
        success: true,
        data
      });

    } catch (err) {
      next(err);
    }

};