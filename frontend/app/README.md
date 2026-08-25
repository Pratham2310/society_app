# Grihive — the society app

One Expo build for everyone inside a society. A guard signs in and lands on the
gate; a committee member gets the controls their role carries; everyone else
gets their home.

Expo **SDK 54**. Expo Go on iOS only ever supports the newest SDK, so if the
store updates past this the project has to move with it:

```bash
npm install expo@^<next>.0.0
npx expo install --fix
npx expo-doctor
```

## Layout

```
app/            expo-router routes
  (tabs)/       home, notices, members, events, finance, profile
  guard/        the gate: scanner and the day's visitors
  security/     visitors, staff, attendance, household staff, status
  <the rest>    amenities, elections, funds, parking, complaints, helpline…
components/     shared pieces
constants/      api.ts (every endpoint), Colors.ts, theme.ts, elections.ts
context/        AuthContext (session, permissions), RegistrationContext
lib/            push, receipts, uploads, session guard, pass sharing
```

`constants/api.ts` is the single list of endpoints. Adding a screen that calls
something new means adding it there, not inlining a URL.

## Things that will bite you

- **Permissions come from the backend, not from the role.** Screens gate on
  `can(PERM.FINANCE_MANAGE)` and friends, fetched at sign-in. The role flags in
  `useRole()` are a rough grouping kept for older screens — prefer `can`, since
  it is what the routes actually enforce, so a button gated on it never 403s.

- **Registration does not sign you in.** The account lands pending and the
  backend refuses a login until the secretary approves it.

- **Profile edits are a request, not a write.** `edit-profile` submits to a
  queue the secretary decides on. The screen already says so.

- **Push does not work in Expo Go.** Remote notifications were removed from it
  in SDK 53, so a token only comes from a development or production build.
  Everything else works normally in Expo Go.

- **Browser push needs VAPID keys.** `lib/push.ts` asks the backend for a public
  key; without `VAPID_PUBLIC_KEY` set server-side it comes back null and web
  push disables itself.

- **The email must have a real TLD.** The backend validates with Joi's
  `.email()`, which rejects `.local` and `.test`.

- **`app.json` still carries someone else's identifiers** — `com.shoaib97.grihive`
  and an EAS `projectId` from the original account. Both need changing before
  any build of your own.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run bundle      # compiles every route through Metro
npx expo-doctor     # dependency and config sanity
```

There is no device in CI. `bundle` proves it compiles and resolves; it proves
nothing about how it looks.
