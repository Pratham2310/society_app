# Coding Rules

Last updated: 2026-07-13

## General

- Follow the existing Express modular architecture.
- Keep route files focused on URLs, HTTP verbs, validation, and middleware.
- Keep controllers thin; put business rules in services.
- Use repositories for reusable or complex database queries.
- Do not duplicate business logic across controllers.
- Do not introduce new dependencies unless the benefit is clear and documented.
- Keep changes scoped to the requested module.
- Preserve backward compatibility unless the task explicitly allows a breaking change.

## Authentication And Authorization

- Use `authMiddleware` for JWT-protected routes.
- Use approval checks for resident/society routes that require approved users.
- Standardize future work on `systemRole` for platform roles and `societyRole` for society roles.
- Do not introduce new role spellings without updating the model enum, validators, middleware, and docs together.
- Never trust client-supplied role or society IDs without checking the authenticated user context.

## Validation

- Add or update Joi schemas for request bodies when APIs accept client data.
- Keep validation close to the route layer.
- Ensure controller/service parameter names match validation schemas.

## Database

- Use Mongoose models for schema constraints and indexes.
- Add indexes for frequently filtered fields and uniqueness rules.
- Document schema changes in `DATABASE.md`.
- Avoid changing existing enum values without a migration plan.

## Errors And Responses

- Use `AppError` or existing helper patterns for expected operational errors.
- Let unexpected errors flow to `errorHandler`.
- Prefer a consistent response shape: `success`, `message`, and `data` where practical.
- Do not leak secrets, tokens, stack traces, or database connection strings in responses or logs.

## Security

- Never log `MONGO_URI`, `JWT_SECRET`, passwords, OTPs, Cloudinary secrets, or bearer tokens.
- Hash passwords with bcrypt before storage.
- Do not commit `.env` files or real credentials.
- Validate uploaded files before relying on them in business workflows.

## Documentation Discipline

After every task, update:

- `CURRENT_PROGRESS.md`
- `CHANGELOG.md`
- `HANDOFF.md`
- `TODO.md` if tasks changed
- `DECISIONS.md` if a technical decision was made
- `API_REFERENCE.md` if endpoints changed
- `DATABASE.md` if schemas changed
- `ARCHITECTURE.md` if architecture changed
