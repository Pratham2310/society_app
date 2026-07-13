# Current Progress

Last updated: 2026-07-13

## Current Module

Project documentation baseline and AI handoff setup.

## Completed Features In Codebase

- Express app and server bootstrap.
- MongoDB connection.
- JWT authentication.
- System role and society role concepts.
- Society creation and code verification.
- Onboarding draft steps and finalize route.
- Wing and flat management.
- User full registration, status approval, user listing, wing-based lookup, role update.
- Resident dashboard route.
- Notice, event, complaint, maintenance, expense, community fund, parking, security, help, upload, payment, guest pass, gate log, visitor approval, service, sales, and admin route modules.
- Mongoose model coverage for the above domains.
- Cloudinary upload configuration.
- QR code helper/service support.

## Work In Progress

- AI_CONTEXT documentation is now initialized as the project knowledge base.
- Runtime health has not yet been verified in this task.

## Pending Tasks

- Fix auth/register argument mismatch.
- Align login validation with login service behavior.
- Standardize role naming and role middleware behavior.
- Fix route/controller typos in guest pass, visitor approval, and map routes.
- Remove secret-bearing Mongo URI logging from server startup.
- Add package scripts for start/dev/test.
- Add automated tests for auth, authorization, and core workflows.
- Review route ordering where parameterized routes may shadow literal routes.

## Known Issues

- `backend/server.js` logs `process.env.MONGO_URI`.
- `backend/routes/guestPassRoutes.js` uses `require("router")` instead of `express.Router()`.
- `backend/routes/visitorApprovalRoutes.js` references `visitorApprovalCOntroller`, which is not defined.
- `backend/routes/mapRoutes.js` has a missing leading slash for the toggle route.
- `authController.register` passes positional arguments to a service expecting an object.
- `authValidation.registerSchema` and `authService.registerUser` disagree on `role` versus `systemRole`.
- `authValidation.loginSchema` supports phone login, but `authService.loginUser` queries by email only.
- Role middleware checks inconsistent properties such as `role`, `societyRole`, `societyrole`, and `soccietyRole`.
- Several role spellings differ across the codebase: `comitee-member`, `commitee_member`, and `committee_member`.
- Some route comments say "secretary actions" but do not enforce secretary-only middleware.

## Blockers

- No `.env` values are documented or present in this task, so runtime connection was not attempted.
- No test command exists in `package.json`.

## Current Milestone

Make the backend stable and self-documented enough for safe feature work: documentation baseline, auth/role cleanup, route bug fixes, then workflow tests.
