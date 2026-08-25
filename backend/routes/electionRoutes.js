const express = require("express");
const router = express.Router();

const electionController = require("../controllers/electionController");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");

// =======================================================
// ELECTIONS
// =======================================================

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);

router.get("/", asyncHandler(electionController.listElections));
router.post("/", asyncHandler(electionController.createElection));

router.get("/:id", asyncHandler(electionController.getElection));

router.post("/:id/candidates", asyncHandler(electionController.addCandidate));
router.delete("/:id/candidates/:candidateId", asyncHandler(electionController.removeCandidate));

router.post("/:id/vote", asyncHandler(electionController.vote));

//Publishing the count. Separate from cancelling, which throws the
//whole thing away.
router.post("/:id/close", asyncHandler(electionController.closeElection));
router.patch("/:id/cancel", asyncHandler(electionController.cancelElection));

module.exports = router;
