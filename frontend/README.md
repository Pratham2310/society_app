# Society Console

The web console for the three roles that do not use the mobile app:
**superadmin**, **salesperson**, and the society **committee**
(chairman, secretary, treasurer, committee member).

Residents and security staff use the Expo app instead — signing in here
with those roles shows a message saying so.

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
- Overview — societies onboarded, residents verified
- Societies — list, and per-society residents/committee/security/staff
- Onboard a society — the four-step wizard, ending in a join code
- Salespeople — superadmin only

**Society** (committee)
- Overview — dues, expenses, funds, open complaints, urgent notice
- Resident approvals — the screen the mobile app waits on
- Notices — publish, mark urgent, delete
- Complaints — the queue, filterable by status

## Not built yet

Maintenance billing, expenses, community funds, parking, gate logs and
guest pass oversight. Their endpoints exist but have never been
exercised, so expect to fix backend bugs as each screen is added.
