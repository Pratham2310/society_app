# Environment Variables

The only env file in this project is `backend/.env`, which holds real
values and is gitignored. This document is the committed reference for
what that file must contain — needed when setting up Render, a new
machine, or a teammate.

`backend/config/env.js` validates the required set on startup and exits
with the missing names rather than failing later on the first request
that needs one.

## Required

Startup fails immediately if any of these are missing.

| Variable | Notes |
|---|---|
| `MONGO_URI` | Atlas connection string. Transactions are used, so this must point at a replica set — Atlas is one by default. |
| `JWT_SECRET` | Minimum 32 characters, enforced at startup. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Changing it invalidates every issued token. |
| `CLOUDINARY_NAME` | Cloud name. |
| `CLOUDINARY_KEY` | API key. |
| `CLOUDINARY_SECRET` | API secret. Also signs the direct-upload signatures. |

## Optional

Everything below has a working default; the app runs without any of them.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `5000` | Render injects this. Only set it locally. |
| `NODE_ENV` | `development` | `production` stops `send-otp` returning the OTP in its response. |
| `CORS_ORIGINS` | empty | Comma-separated web console origins. Empty blocks all browser origins. Does not affect the Expo app, which does not enforce CORS. |
| `GATE_LOG_RETENTION_DAYS` | unset | Unset keeps gate logs forever. Setting it creates a TTL index that **permanently deletes** visitor history older than the window. |
| `MIN_CLIENT_VERSION` | `1.0.0` | Expo builds below this are told to block and update. |
| `LATEST_CLIENT_VERSION` | `1.0.0` | Below this the app prompts but allows continuing. |
| `SENTRY_DSN` | unset | Without it, error tracking is entirely inert. |
| `SENTRY_TRACES_RATE` | `0` | Performance sampling. Costs money above 0. |
| `RELEASE` | unset | Git SHA or build id, so an Expo crash lines up with the backend error. |
| `LOG_LEVEL` | `debug` / `info` | `info` in production, `debug` otherwise. |
| `SUPERADMIN_PASSWORD` | — | Read only by `npm run bootstrap:superadmin`. Set it in the shell for that one command; do not leave it in `.env`. |

## Not used

- `REDIS_URL` — present in `.env` but nothing reads it. `utils/redisClient.js`
  is entirely commented out. Safe to delete unless Redis is reintroduced
  for shared rate-limit state or caching.

## Render

Set the five required variables plus `CORS_ORIGINS` and `SENTRY_DSN` in
the dashboard. `render.yaml` lists them as `sync: false`, meaning Render
expects them to be provided there and never read from the repo.

The cron services need the same `MONGO_URI` and `JWT_SECRET` as the web
service — they load the same config validator.
