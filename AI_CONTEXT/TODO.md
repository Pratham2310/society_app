# TODO

Last updated: 2026-07-13

## High Priority

- Fix `authController.register` to call `authService.registerUser` with the expected data object, or change the service signature consistently.
- Decide whether login supports email only or email/phone, then align `authValidation.loginSchema` and `authService.loginUser`.
- Remove `console.log("MONGO URI:", process.env.MONGO_URI)` from `backend/server.js`.
- Replace `require("router")` in `guestPassRoutes.js` with `express.Router()`.
- Fix `visitorApprovalCOntroller` typos in `visitorApprovalRoutes.js`.
- Add missing slash to `mapRoutes.js` toggle route.
- Standardize role names and role middleware around one source of truth.

## Medium Priority

- Add `scripts` to `package.json` for `start`, `dev`, and `test`.
- Add integration tests for auth, user approval, society creation, guest pass, gate log, visitor approval, maintenance, and parking.
- Audit all protected routes to ensure auth, approval, and role checks match business intent.
- Review route ordering in modules with literal and `/:id` routes.
- Normalize response shape across controllers.
- Review Mongoose model names and refs for case-sensitive consistency.

## Low Priority

- Clean encoding artifacts in comments.
- Remove unused imports and commented-out route blocks once confirmed obsolete.
- Document example `.env` values in a safe `.env.example`.
- Add seed script documentation.

## Completed

- 2026-07-13: Created the `AI_CONTEXT` documentation folder and baseline project documentation.

## Next Recommended Task

Start with auth and route correctness fixes, because several current issues can prevent key APIs from working reliably.
