# Admin Portal

The platform's own console: **superadmin**, **admin** and
**salesperson**. Onboarding societies, managing salespeople, and the
shared service catalogue.

Everyone inside a society uses the app in `../app` — residents, security
staff, and the committee alike. A secretary approving a resident, a
treasurer verifying a payment and a guard scanning a pass all happen on
a phone, which is why there are no finance, amenity or election screens
here even though the backend serves them.

## Demo data

    npm run seed:demo             # from the repo root
    npm run seed:demo -- --clean  # remove it again

Creates two salespeople, four societies with wings and flats generated
the same way onboarding generates them, a secretary per society, four
residents awaiting approval, notices, and a service catalogue. Every
account uses the password in that script's header.

Accounts worth signing in as:

| Email | Sees |
|---|---|
| `rohitdeshmuk@demo.example.com` | Salesperson — two societies |
| `sec.emeraldheigh@demo.example.com` | Secretary — 4 approvals, 3 notices |

Note on emails: Joi validates the TLD against the IANA list, so
addresses ending in `.local` or `.test` are rejected at both
registration and login. Use a real TLD.

## Running it

The backend must be running first, and this origin must be in its
`CORS_ORIGINS` (http://localhost:5173 already is).

    cd backend && npm start      # from the repo root: npm start
    cd frontend && npm install && npm run dev

Open http://localhost:5173.

## Keeping types honest

The backend generates `backend/openapi.json` from its own route table.
Regenerate the TypeScript types whenever it changes:

    npm run types

## How it is put together

- `src/lib/api.ts` — the only place that knows about the
  `{ success, message, data, meta }` envelope. Screens get `data` or an
  `ApiError`. Clears the token and bounces to sign-in on a 401; leaves a
  403 alone, because that means the role is wrong, not the session.
- `src/lib/auth.tsx` — session plus role helpers mirroring
  `backend/utils/roles.js`. A superadmin is a superset of a salesperson
  there, so it is here too.
- `src/components/Layout.tsx` — navigation is built from the signed-in
  role rather than shown and then refused.

## Screens

**Platform** (superadmin, salesperson)
- Dashboard — societies onboarded, residents verified
- Societies — list, per-society residents/committee/security/staff, and a
  Manage tab: correct details, assign or replace the secretary, attach
  services from the catalogue, and (superadmin only) delete an empty
  society
- Draft — onboardings started but not finalised; resume or discard
- Services — the shared catalogue residents see on their map
- Salespeople — the roster with societies onboarded per person; edit in
  place, suspend, reactivate, or delete. Superadmin only

The onboarding wizard is reached from Dashboard or Societies rather than
its own nav item, since it is an action rather than a place.

**Society** (committee) — *out of scope, pending removal*

These were built before committee work moved to the app, and they still
work:

- Overview — dues, expenses, funds, open complaints, urgent notice
- Residents — the approval queue, plus the roster: change someone's
  flat, or remove them when they move out. Declining or moving hands
  the old flat back so the real occupant can register
- Notices — publish, mark urgent, delete
- Complaints — the queue, filterable by status

The app now covers all four, so these are duplicates with a second set
of bugs. They are kept only so nothing is lost while the decision is
confirmed — do not add to them, and delete them once the app has been
exercised against a real society.

## Deliberately not here

Maintenance billing, expenses, community funds, amenities, elections,
parking, gate logs and guest passes. The backend serves all of them and
they are covered by tests, but they belong to a committee, and a
committee is on a phone.
