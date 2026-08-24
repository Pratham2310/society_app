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

//=====================================================================
//SOCIETY MANAGEMENT (platform roles)
//=====================================================================

//Details only — societyCode stays fixed, because residents have it
//written down and changing it breaks pending registrations.
router.patch(
  "/:societyId",
  auth, tenantScope, checkSystemRole("superadmin", "salesperson"),
  validateParams(societyIdParamSchema),
  asyncHandler(societyController.updateSociety)
);

//Superadmin only, and refused while anyone lives there. Requires the
//society's name repeated back in the body.
router.delete(
  "/:societyId",
  auth, tenantScope, checkSystemRole("superadmin"),
  validateParams(societyIdParamSchema),
  asyncHandler(societyController.deleteSociety)
);

//Promote a resident, or create the account outright. Steps the previous
//secretary down in the same transaction so there is only ever one.
router.post(
  "/:societyId/secretary",
  auth, tenantScope, checkSystemRole("superadmin", "salesperson"),
  validateParams(societyIdParamSchema),
  asyncHandler(societyController.assignSecretary)
);

//Everyone in the society, for the promote-someone picker.
router.get(
  "/:societyId/members",
  auth, tenantScope, checkSystemRole("superadmin", "salesperson"),
  validateParams(societyIdParamSchema),
  asyncHandler(societyController.listMembers)
);

//=====================================================================
//SERVICES ATTACHED TO A SOCIETY
//
//The existing /services/:id/assign routes are service-centric — one
//service, many societies. These are the other way round, which is how
//you think about it when looking at one society.
//=====================================================================

router.get(
  "/:societyId/services",
  auth, tenantScope, checkSystemRole("superadmin", "salesperson"),
  validateParams(societyIdParamSchema),
  asyncHandler(societyController.listSocietyServices)
);

router.post(
  "/:societyId/services",
  auth, tenantScope, checkSystemRole("superadmin", "salesperson"),
  validateParams(societyIdParamSchema),
  asyncHandler(societyController.addSocietyServices)
);

//Per-society flags: recommended, emergency, hidden, and a local note.
router.patch(
  "/:societyId/services/:serviceId",
  auth, tenantScope, checkSystemRole("superadmin", "salesperson"),
  validateParams(societyIdParamSchema),
  asyncHandler(societyController.updateSocietyService)
);

//Detaches only. The service stays in the shared catalogue for everyone
//else still using it.
router.delete(
  "/:societyId/services/:serviceId",
  auth, tenantScope, checkSystemRole("superadmin", "salesperson"),
  validateParams(societyIdParamSchema),
  asyncHandler(societyController.removeSocietyService)
);

module.exports = router;
