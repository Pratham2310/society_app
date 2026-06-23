const Joi = require("joi");

exports.updateSecurityStatusSchema = Joi.object({

  status: Joi.string()
    .valid(
      "at_home",
      "away",
      "do_not_disturb"
    )
    .required(),

  instructions: Joi.string()
    .allow("")
    .optional(),

  from: Joi.date()
    .allow(null)
    .optional(),

  to: Joi.date()
    .allow(null)
    .optional(),

  autoReset: Joi.boolean()
    .optional()
});

exports.createVisitorRequestSchema = Joi.object({

  visitorName: Joi.string()
    .required(),

  purpose: Joi.string()
    .valid(
      "delivery",
      "guest",
      "maintenance",
      "other"
    )
    .required(),

  visitorPhoto: Joi.string()
    .allow(null, ""),

  vehicleNumber: Joi.string()
    .allow(null, ""),

  vehiclePhoto: Joi.string()
    .allow(null, ""),

  messageToGuard: Joi.string()
    .allow("")
});

exports.createStaffSchema = Joi.object({

  name: Joi.string()
    .required(),

  phone: Joi.string()
    .required(),

  role: Joi.string()
    .valid(
      "maid",
      "cook",
      "driver",
      "laundry",
      "milk_delivery",
      "gardener",
      "cleaner",
      "other"
    )
    .required(),

  photo: Joi.string()
    .allow(null, ""),

  govtId: Joi.string()
    .allow(null, "")
});

exports.markAttendanceSchema = Joi.object({

  staffId: Joi.string()
    .required(),

  status: Joi.string()
    .valid(
      "present",
      "leave",
      "absent"
    )
    .required(),

  notes: Joi.string()
    .allow("")
});


exports.createSecurityAlertSchema = Joi.object({

  type: Joi.string()
    .valid(
      "fraud",
      "emergency",
      "security_warning"
    )
    .required(),

  message: Joi.string()
    .required(),

  visitorRequestId: Joi.string()
    .allow(null, "")
});