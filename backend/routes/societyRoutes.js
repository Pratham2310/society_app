const express = require("express");
const router = express.Router();

const societyController = require("../controllers/societyController");
const asyncHandler =require("../utils/asyncHandler");
const validate=require("../middleware/validate");
const {createSocietySchema,verifySocietyCodeSchema}=require("../validation/societyValidation");
const auth=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const role =
  require("../middleware/requireRole").requireSystemRole;
const ROLES = require("../utils/roles");
const checkSystemRole =
  require("../middleware/requireRole").requireSystemRole;
const { authLimiter } =
  require("../middleware/rateLimitMiddleware");
const {
  societyIdParamSchema
} = require("../validation/societyValidation");
const validateParams =
  require("../middleware/validateParams");

router.post("/", auth, tenantScope,checkSystemRole("superadmin","salesperson"),validate(createSocietySchema), asyncHandler(societyController.createSociety));

router.post("/verify-code", authLimiter, validate(verifySocietyCodeSchema), asyncHandler(societyController.verifySocietyCode));

//PUBLIC. Wings, floors and flats for the registration form. The
//resident has no token yet — register-full is what creates the
//account. The society code gates access: the client only holds a
//societyId because verify-code returned one. Rate limited because
//anything unauthenticated is.
router.get(
  "/:societyId/structure",
  authLimiter,
  validateParams(societyIdParamSchema),
  asyncHandler(societyController.getRegistrationStructure)
);

module.exports = router;