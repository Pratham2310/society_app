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

router.post("/", auth, tenantScope,checkSystemRole("superadmin","salesperson"),validate(createSocietySchema), asyncHandler(societyController.createSociety));

router.post("/verify-code", validate(verifySocietyCodeSchema), asyncHandler(societyController.verifySocietyCode));

module.exports = router;