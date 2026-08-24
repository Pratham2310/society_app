# Society Ledger — mobile

The resident and security app. One Expo build serves both: a guard signs in
and gets the gate, everyone else gets their home.

## Running it

```bash
npm install
npm start
```

Then press `a` for Android or `i` for iOS, or scan the QR code with Expo Go.

### Point it at a backend

`app.json` carries `extra.apiUrl`, which defaults to `http://localhost:5000/api/v1`.

**That default only works in a simulator.** A physical phone has its own
`localhost`, so it will never reach your laptop. Use your machine's LAN address
instead:

```jsonc
// app.json
"extra": { "apiUrl": "http://192.168.1.20:5000/api/v1" }
```

`ipconfig` will tell you which address to use. The backend must also allow that
origin — see `CORS_ORIGINS` in the backend `.env`.

## What is here

```
app/
  _layout.tsx        session gate + query client
  join/              code → welcome → sign in / register (4 steps) → submitted
  (app)/
    _layout.tsx      tabs, built from the signed-in role
    index.tsx        home (resident) or gate (guard)
    notices.tsx      cursor-paginated notice feed
    visitors.tsx     approvals + guest passes
    scan.tsx         guard QR scanner, not a tab
    profile.tsx      identity, push toggle, sign out
src/
  lib/api.ts         envelope unwrap, SecureStore token, idempotency keys
  lib/auth.tsx       session, role helpers
  lib/push.ts        Expo push registration
  theme/             colours, spacing, type
  components/ui.tsx  the shared primitives
```

## Things worth knowing before you build

- **The join flow is code-first.** A resident enters the society's 6-digit code,
  and only then sees wings, floors and flats. `GET /societies/:id/structure` is
  public for exactly this reason — the resident has no account yet.

- **Registration does not sign you in.** The account lands pending and the
  backend refuses a login until the secretary approves it. `app/join/submitted.tsx`
  says so, so a resident does not read "not verified" as their own mistake.

- **The email must have a real TLD.** The backend validates with Joi's `.email()`,
  which rejects `.local` and `.test`. Use a real-looking domain in test data.

- **Gate scans are idempotent.** Every `POST /gate-log/scan-*` carries an
  `Idempotency-Key`, and the scanner locks on a ref rather than state — the
  camera fires the same barcode many times a second.

- **Push does not work in Expo Go.** Remote notifications were removed from Expo
  Go in SDK 53, so a token can only come from a development or production build.
  `registerForPush()` reports why it could not get one and the profile screen
  says so; everything else works normally. Before a production build, FCM
  (Android) and APNs (iOS) credentials have to be uploaded to EAS.

## SDK version

This targets **Expo SDK 54**. Expo Go on iOS only ever supports the newest SDK,
so if the app store updates Expo Go past this, the project has to move with it:

```bash
npm install expo@^<next>.0.0
npx expo install --fix
npx expo-doctor
```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run bundle      # compiles every route through Metro
npx expo-doctor     # dependency and config sanity
```

`bundle` is the strongest gate available without a device — it resolves and
compiles every route and native module. It will not tell you whether anything
looks right. The screens have not been rendered.
