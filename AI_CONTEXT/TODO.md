# TODO

Last updated: 2026-08-22 (Phase 6 complete - all phases done)

## Lint Backlog — CLEARED

All 57 `no-undef` errors are fixed and `npm run lint` is now a blocking
CI gate. Any new undefined identifier fails the build instead of waiting
to surface as a ReferenceError in production.

## High Priority

- Fix `authController.register` to call `authService.registerUser` with the expected data object, or change the service signature consistently.
- Decide whether login supports email only or email/phone, then align `authValidation.loginSchema` and `authService.loginUser`.
- Standardize role names and role middleware around one source of truth.

## Medium Priority

- Add integration tests for auth, user approval, society creation, guest pass, gate log, visitor approval, maintenance, and parking.
- Audit all protected routes to ensure auth, approval, and role checks match business intent.
- Normalize response shape across controllers.
- Review Mongoose model names and refs for case-sensitive consistency.

## Low Priority

- Clean encoding artifacts in comments.
- Remove unused imports and commented-out route blocks once confirmed obsolete.
- Add seed script documentation.

## Role Model (confirmed with the product owner)

Two society roles are easily confused and are NOT interchangeable:

- `security` - the guard on the gate. STAFF, not a resident. Deliberately
  excluded from RESIDENTS and COMMITTEE in `utils/roles.js`. Gate duties
  only: scan entry/exit, read a guest pass to verify it, RAISE a visitor
  approval request. Never resident or financial powers, and never answers
  an approval.
- `secretary` - a RESIDENT who holds committee authority. In both
  RESIDENTS and COMMITTEE. Gets society-wide oversight (gate logs,
  statistics, approving and archiving guest passes) AND ordinary resident
  rights, because they live here too.

Committee authority is over the society's affairs, not over who enters
another resident's home. A secretary cannot approve a visitor for someone
else's flat.

## Environment Files

There is exactly ONE env file: `backend/.env`, holding real values and
gitignored. A `.env.example` was added in Phase 0 and REMOVED afterwards
at the product owner's request — do not re-add it.

Because `.env` is gitignored, the committed reference for what it must
contain lives in `AI_CONTEXT/ENVIRONMENT.md`, and `config/env.js` points
there when startup validation fails. Keep that document in step with
`config/env.js` REQUIRED.

Note: the Phase 0 entry below and `PRODUCTION_AUDIT.md` both mention
`.env.example`. Those are dated records of what was true then, not
current guidance.

## Completed

- 2026-08-22: Role semantics corrected after the product owner clarified
  that `security` (gate staff) and `secretary` (resident with committee
  authority) are distinct.

  Found and fixed a real authorization gap: `approveRequest` and
  `rejectRequest` fetched the approval scoped only by societyId and never
  checked it belonged to the calling resident. Any member of the society
  could therefore approve a visitor into a NEIGHBOUR's flat - tenant
  scoping stopped Society B but nothing stopped resident X answering for
  resident Y. Added validateApprovalOwnership on both paths; committee
  roles get no exemption, because authority over society affairs is not
  authority over someone else's front door.

  Also widened approve/reject/resident-pending from member+chairman to
  every resident role. A treasurer, secretary or committee member is
  still a resident with a door, and was previously locked out of
  answering their own visitor.

  Six tests now lock the distinction: security is not a resident and
  holds no committee authority; secretary is both; guards get no
  financial or resident routes; a guard can raise an approval but never
  answer one.


- 2026-08-22: Phase 6 complete - operations and confidence.

  Structured logging with pino. Every request carries an id, echoed as
  X-Request-Id and honoured if the client supplies one, so an Expo crash
  report and the backend log line share an identifier. Redaction covers
  authorization headers, passwords, OTPs, tokens and connection strings -
  a logger that cannot leak secrets is stronger than remembering not to
  log them. Health checks are silenced. All console calls in application
  code are gone, and a test now fails the build if one returns.

  Sentry, optional by design: with no SENTRY_DSN it is entirely inert, so
  CI and local development need no account. sendDefaultPii is off and a
  beforeSend hook strips bodies, cookies and auth headers. Only 5xx is
  reported - alerting on 404s trains people to ignore the channel.

  Append-only audit log on payments, role changes and status changes,
  carrying actor, action, target, requestId and IP. Writes are wrapped:
  refusing a payment because the audit collection hiccupped would be
  worse than the gap in the record.

  Four idempotent scheduled jobs (guest pass expiry, visitor approval
  expiry, OTP cleanup, abandoned idempotency keys) with a --dry mode,
  wired as Render cron services in render.yaml rather than an in-process
  timer, which would double up the moment the web service scales past one.

  17 integration tests against a real MongoDB, each run using a
  throwaway database that is dropped afterwards. CI now starts a
  single-node replica set, because the transaction paths need one.
  Total suite: 107 tests.

  The integration suite immediately caught a regression introduced in
  Phase 2: restructuring roles.js nested the role constants, but four
  route files reference ROLES.SECRETARY and friends at the top level, so
  those guards had been receiving undefined and denying everyone. Flat
  constants are now exported alongside the grouped ones.


- 2026-08-22: Phase 5 complete - mobile-specific backend work.

  Expo push is wired end to end. `pushTokens[]` on the user document,
  a send service batching at Expo's 100-message limit, device
  register/unregister routes, and a notification service that writes the
  in-app inbox row AND dispatches the push. Push is best-effort and
  wrapped: a visitor is still logged at the gate if Expo is unreachable.
  Verified against the real Expo API - it returned DeviceNotRegistered
  for a fake token and the service self-healed by pruning it from the
  user. Registering a token also releases it from any previous owner,
  because guards share handsets across shifts. Device registration
  deliberately sits outside checkApproved, since a pending resident
  still needs "your account was approved". Visitor approval requests now
  notify the resident, which is the whole point of the feature.

  Idempotency for gate scans and payments via an `Idempotency-Key`
  header, backed by a unique { userId, key } index so a concurrent
  double-submit is safe, with a 24h TTL. Same key on a different
  endpoint is rejected rather than replayed; a FAILED attempt stays
  retryable. Verified live: two identical scan requests produced exactly
  one gate log, the second carrying `Idempotent-Replay: true`.

  Signed direct-to-Cloudinary uploads (`POST /uploads/signature`), scoped
  to the caller's society folder, so resident photos never transit the
  512MB Render instance twice.

  `GET /client-version` reports minimum and latest supported build. It
  is the only lever that makes a future breaking change possible for an
  installed Expo app.

  Found and fixed while testing: `buildEntryLog` and `buildExitLog` never
  set `wingId`, which GateLog requires - so EVERY gate scan would have
  failed schema validation in production. They also passed populated
  documents where plain refs were expected; both now unwrap via refId().


- 2026-08-22: Phase 4 complete - one API contract for three clients.
  The API is mounted at `/api/v1` from a single route table
  (`routes/index.js`); `/api` still works but sends `Deprecation` and a
  `Link` header pointing at the successor. Versioning had to land before
  the Expo app ships - an installed build cannot be upgraded on demand.

  One response envelope `{ success, message, data, meta? }` applied
  centrally in middleware rather than by editing ~150 call sites, so the
  contract is guaranteed rather than intended. It also absorbs the two
  shape typos that shipped (`{succes}`, `{messsage}`). 54 catch blocks
  that hardcoded 500 now preserve the error's status, so the 404s that
  tenant scoping produces are no longer reported as server errors.

  Pagination in two layers. A wire-level cap in the envelope means no
  response can carry an unbounded collection, and it says `truncated:true`
  rather than silently dropping rows; this is deliberately separate from
  query-level paging because capping at the database would also truncate
  internal batch reads such as bill generation. Notices and complaints
  have real DB pagination supporting both styles: offset with totals for
  the web console tables, cursor for the Expo infinite lists. Limit is
  clamped to 100. Found and fixed that cursor mode could never START -
  the first page had no cursor to hand back, so `?mode=cursor` now opens
  a sequence. Also fixed `complaintRepository.findAll`, which had no
  return statement and so always resolved to undefined.

  `backend/openapi.json` is GENERATED from the route table
  (`npm run openapi`), served raw at `/api/v1/openapi.json`, and checked
  in CI so it cannot go stale. 130 operations across 112 paths. The
  generator surfaced a would-be issue: it parsed commented-out routes,
  which listed a disabled unauthenticated `/users/pending-users`. A test
  now locks the public surface to exactly the six auth and signup
  endpoints, so a new unauthenticated route fails the build.


- 2026-08-22: Phase 3 complete - data correctness.
  Rebuilt `repository/visitorApprovalRepository.js`: it opened with a
  verbatim copy of the VisitorApproval schema and ended with
  `module.exports = mongoose.model(...)`, so the service imported a model
  rather than a repository - `findById` and `create` resolved to model
  statics that bypassed societyId scoping, and the other twelve methods
  did not exist. Four missing methods written, all lookups now scoped.

  Cleared the remaining 34 lint errors, among them a comma instead of a
  dot in `res.status(500),json(...)`, `math.random`, `Req`/`req` casing in
  four files, an import typo (`toggeleVisibilitySchema`), a missing uuid
  import, a duplicate export key, and `buildQrPayload` / 
  `qrService.generateQRCode`, neither of which existed. Lint is now a
  blocking CI gate.

  Migration 002 repaired live indexes: `ResidentSecurityStatus` had
  `residentId` and `societyId` each unique on their own, capping every
  society at ONE status record, plus a stray unique `userId_1` from an
  older schema; `MaintenanceBill` had `userId_1_month_1` with no
  societyId. Both replaced with correct compound unique indexes, and
  bill generation made idempotent via unordered insert with duplicate
  handling.

  Fixed `CommunityFund` being registered as `communityFund` while
  `Contribution.fundId` referenced `CommunityFund`, so populate failed.
  Fund approval called `.save()` on a lean object (a guaranteed
  TypeError) and did a read-modify-write on `collectedAmount`; it now
  uses an atomic `$inc` inside a transaction. Payment/bill, parking
  allotment/slot and contribution/fund flows are all transactional.

  Gate log retention is opt-in via `GATE_LOG_RETENTION_DAYS` - permanently
  deleting visitor history is a policy decision, not a silent default.


- 2026-08-22: Phase 2 complete - identity and tenant isolation.
  `utils/roles.js` is now the single source of truth; the User schema
  imports its enums from it. Migrated role values (`comitee-member`,
  `commitee_member`, `guard`, `admin`) and fixed 18 references to the
  misspelled `societyrole` field, which Mongoose strict mode had been
  silently dropping - role changes such as "promote to secretary" were
  no-ops. Migration 001 repaired 7 live documents, including a secretary
  who had been running without secretary permissions. Collapsed five
  disagreeing role middlewares into `requireSystemRole` and
  `requireSocietyRole` and deleted the old ones.

  Tenant isolation is now enforced structurally rather than per query: a
  `societyScope` Mongoose plugin reads an AsyncLocalStorage tenant context
  bound by `tenantScope` middleware, and constrains every find, update,
  delete and aggregate on any schema with a societyId path. This closed
  all 40 unscoped findById-style calls across 14 repositories at once, and
  protects code not yet written. superadmin and salesperson bypass it via
  an explicit `crossTenant` flag; scripts and seeds run unscoped because
  they have no context. Verified live with two societies: cross-society
  read, update and delete all return 404 and leave the data intact.


- 2026-08-22: Phase 1 complete - security lockdown. Rotated JWT_SECRET to 96
  chars and added issuer/audience/tokenVersion claims with per-surface TTLs
  (8h for superadmin and salesperson, 30d for residents). Removed the public
  POST /api/admin/create-superadmin route in favour of
  `npm run bootstrap:superadmin`. Closed a second privilege-escalation path
  where public registration accepted `systemRole` from the request body.
  Password is now select:false with a toPublicUser serializer and a toJSON
  transform. OTPs are bcrypt-hashed with a TTL index, 5-attempt cap and 60s
  per-account resend cooldown, and are no longer logged. Uploads now require
  auth plus approval, cap at 5MB, validate MIME, and are scoped to a
  per-society Cloudinary folder. Enabled rate limiting keyed on identifier
  rather than IP (carrier NAT). Added helmet, a CORS allowlist, body size
  caps, trust proxy, and /health and /ready endpoints. Replaced
  multer-storage-cloudinary (peer-locked to cloudinary v1) with a local
  storage engine. Fixed the register controller argument mismatch and phone
  login. Test suite now 19 cases.

- 2026-08-22: Phase 0 complete - app loads with all 25 route modules mounted.
  Created `utils/transactionHelper.js` and implemented `utils/validationHelper.js`;
  consolidated `catchAsync`/`sendResponse` onto `asyncHandler`/`responseHelper`;
  gave `cludinaryUploads` a `deleteFile` export and an object return; repaired the
  guest pass, gate log and visitor approval routes and controllers; hoisted
  `createGuestPassFromApproval` out of `getGuestPassStatistics`; fixed the
  `guestLogSchema`/`gateLogSchema` mismatch; renamed five misspelled files;
  fixed the unreachable `next()` in `authorizeRoles`; added an env contract,
  startup config validation, graceful shutdown, ESLint, Prettier, a 9-case
  smoke suite and a CI workflow.
- 2026-07-13: Created the `AI_CONTEXT` documentation folder and baseline project documentation.

## Next Recommended Task

All six phases are complete. The remaining work is ordinary product
work rather than remediation - see Known Remaining Work below.

## Before Going Live

- Upload FCM (Android) and APNs (iOS) credentials to EAS, or push
  silently fails in production builds.
- Set CORS_ORIGINS to the real web console domains.
- Decide GATE_LOG_RETENTION_DAYS.
- Run `npm run bootstrap:superadmin` once.
- Rotate the MongoDB password - it was printed to logs before Phase 1.

## Known Remaining Work

- Pagination: notices and complaints have query-level paging; the other
  ~30 collection endpoints rely on the wire-level cap and should get real
  paging as they become hot.
- `complaintController.js` and `onboardingController.js` still wrap every
  handler in try/catch rather than using asyncHandler.
