# Society Console

The web console for the three roles that do not use the mobile app:
**superadmin**, **salesperson**, and the society **committee**
(chairman, secretary, treasurer, committee member).

Residents and security staff use the Expo app instead — signing in here
with those roles shows a message saying so.

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
- Societies — list, and per-society residents/committee/security/staff
- Draft — onboardings started but not finalised; resume or discard
- Services — the shared catalogue residents see on their map
- Salespeople — the roster with societies onboarded per person, superadmin only

The onboarding wizard is reached from Dashboard or Societies rather than
its own nav item, since it is an action rather than a place.

**Society** (committee)
- Overview — dues, expenses, funds, open complaints, urgent notice
- Resident approvals — the screen the mobile app waits on
- Notices — publish, mark urgent, delete
- Complaints — the queue, filterable by status

## Not built yet

Maintenance billing, expenses, community funds, parking, gate logs and
guest pass oversight. Their endpoints exist but have never been
exercised, so expect to fix backend bugs as each screen is added.
