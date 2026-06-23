const Joi = require("joi");

// 🔥 CREATE COMPLAINT
exports.createComplaintSchema = Joi.object({

  title: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      "string.empty": "Title is required",
      "string.min": "Title must be at least 3 characters"
    }),

  description: Joi.string()
    .min(5)
    .required()
    .messages({
      "string.empty": "Description is required"
    }),

  category: Joi.string()
    .valid("plumbing", "electrical", "security", "general")
    .required()
    .messages({
      "any.only": "Invalid category",
      "string.empty": "Category is required"
    }),

  isUrgent: Joi.boolean().optional(),

  image: Joi.string().uri().optional() // URL for now

});


// 🔥 UPDATE STATUS
exports.updateStatusSchema = Joi.object({

  status: Joi.string()
    .valid("pending", "reviewed", "in_progress", "resolved")
    .required()
    .messages({
      "any.only": "Invalid status value",
      "string.empty": "Status is required"
    })

});