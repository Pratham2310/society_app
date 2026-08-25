# Frontend

Two clients, one backend.

```
frontend/
  adminportal/   Vite + React. Superadmin, admin and salespeople.
  app/           Expo. Residents, committee and security guards.
```

## Which does what

**adminportal** is the platform's own console: onboarding societies, managing
salespeople, the service catalogue. It is deliberately *not* where a committee
does its work — a secretary approving a resident, a treasurer verifying a
payment and a guard scanning a pass all happen in the app.

**app** is everything a society sees. One Expo build serves three kinds of
person: a guard signs in and lands on the gate, a committee member gets the
management controls their role carries, and everyone else gets their home.

That split is why `adminportal` has no finance, amenities or election screens
even though the backend serves them — those belong to a committee, and a
committee is on a phone.

## Running them

Each folder has its own `package.json` and installs independently.

```bash
cd app         && npm install && npm start   # then scan with Expo Go
cd adminportal && npm install && npm run dev
```

Both need the backend running. From `app/` there are shortcuts that start it
alongside:

```bash
npm run dev       # backend + the Expo app
npm run dev:web   # backend + the admin portal
```

## Pointing them at the backend

They resolve it differently, which trips people up.

**app** works it out from the Expo dev server — the phone already knows your
machine's LAN address because it downloaded the bundle from it, so port 5000
on the same host is assumed. Override with `EXPO_PUBLIC_API_URL` in `app/.env`
when that guess is wrong (a tunnel, or a deployed backend).

**adminportal** reads `VITE_API_URL` from `adminportal/.env.development`.

A device can never reach `localhost` — that is the device's own loopback, not
your laptop's. Use the LAN address, and make sure it is in the backend's
`CORS_ORIGINS`.

## Checks

```bash
cd app         && npm run typecheck && npm run bundle
cd adminportal && npm run build
```

`bundle` compiles every route in the app through Metro. It is the strongest
gate available without a device, and it will not tell you whether anything
*looks* right.
