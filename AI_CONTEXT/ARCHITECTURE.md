# Architecture

Last updated: 2026-07-13

## High-Level Flow

1. `backend/server.js` loads `.env`, calls `connectDB()`, and starts the Express app.
2. `backend/app.js` applies `express.json()` and `cors()`, mounts module routes under `/api/*`, handles unmatched routes with `AppError`, then delegates errors to `errorHandler`.
3. Routes apply authentication, approval, role, and validation middleware where needed.
4. Controllers handle HTTP-level concerns and call service methods.
5. Services hold business logic and delegate persistence to repositories or Mongoose models.
6. Models define MongoDB collections through Mongoose schemas.

## Layer Responsibilities

- Routes: URL structure, HTTP verbs, route-level middleware, validation middleware.
- Controllers: request/response orchestration, status codes, basic error forwarding.
- Services: domain rules, status transitions, calculations, cross-model operations.
- Repositories: database reads/writes for complex modules.
- Models: schema fields, relationships, enum constraints, indexes.
- Middleware: auth, authorization, user approval checks, validation, uploads, rate limits, errors.
- Utils: reusable helpers with no direct HTTP routing responsibility.

## Authentication Flow

- Login/register logic is in `backend/services/authService.js`.
- JWT payload includes `id`, `systemRole`, `societyRole`, and `societyId`.
- `backend/middleware/authMiddleware.js` expects `Authorization: Bearer <token>`, verifies with `JWT_SECRET`, and sets `req.user`.
- Token expiry is currently `7d`.
- Normal member login is restricted when `societyRole === "member"` and `systemRole === "user"` unless `isVerified` is true and `status === "approved"`.

## Authorization Flow

There are multiple role middleware styles:

- `checkSystemRole(...roles)`: checks `req.user.systemRole`.
- `roleMiddleware(...roles)`: checks `req.user.role`; some routes use this even though JWT currently exposes `societyRole`, not `role`.
- `checkRole(allowedRoles)`: checks `req.user.societyRole`, but its parameter handling expects an iterable and some routes pass a string.
- `authorizeRoles(...roles)`: checks `req.user.role || req.user.soccietyRole`; this contains a spelling mismatch and does not check `societyRole`.
- `checkApproved`: loads the current user and blocks users whose `status` is not `approved`.

Because of these inconsistencies, authorization behavior should be reviewed before expanding protected APIs.

## Route Mounts

- `/api/auth`
- `/api/societies`
- `/api/flats`
- `/api/wings`
- `/api/users`
- `/api/residents/dashboard`
- `/api/notices`
- `/api/admin`
- `/api/onboarding`
- `/api/sales`
- `/api/services`
- `/api/events`
- `/api/complaints`
- `/api/maintenance`
- `/api/expenses`
- `/api/community-funds`
- `/api/parking`
- `/api/security`
- `/api/map`
- `/api/help`
- `/api/uploads`
- `/api/payments`
- `/api/guest-passes`
- `/api/gate-log`
- `/api/visitor-approvals`

`/api/invites` exists as commented-out route mounting in `app.js`.

## Design Patterns

- Modular Express routing per domain.
- Mostly thin controllers with services for core behavior.
- Repository layer used heavily for domains such as users, parking, visitor approvals, guest passes, services, payments, and maintenance.
- Joi schemas used for request validation in selected modules.
- Mongoose indexes enforce uniqueness in several schemas.
- Global JSON error response through `errorHandler`.

## Third-Party Integrations

- MongoDB for persistence.
- Cloudinary for file storage.
- JWT for stateless auth.
- bcrypt for hashing.
- QR code generation for guest-pass and visitor workflows.
- Redis helper exists but does not appear wired into the app startup.

## Known Architectural Risks

- `server.js` logs `MONGO_URI`; this can expose secrets in logs.
- Auth and role naming are inconsistent: `societyRole`, `societyrole`, `role`, `comitee-member`, `commitee_member`, `committee_member`, and `guard/security` are all present.
- Some route files contain defects that can break runtime behavior, including `guestPassRoutes.js` requiring `router` instead of using `express.Router()`, and `visitorApprovalRoutes.js` referencing `visitorApprovalCOntroller`.
- `authController.register` calls `authService.registerUser` with positional arguments, while the service expects a data object.
- `authValidation.registerSchema` requires `role`, but `authController.register` does not read it and `authService.registerUser` expects `systemRole`.
- `authValidation.loginSchema` supports `identifier` as email or phone, but `authService.loginUser` queries `{ email }` only.
- `mapRoutes.js` has `router.patch("services/:id/toggle", ...)` without a leading slash.
