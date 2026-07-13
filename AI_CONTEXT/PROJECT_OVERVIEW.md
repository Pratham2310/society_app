# Project Overview

Last updated: 2026-07-13

## Purpose

This repository contains the backend API for a society management application. It manages residential societies, onboarding, residents, roles, flats, wings, notices, events, complaints, maintenance bills, expenses, community funds, parking, security operations, guest passes, gate logs, visitor approvals, staff/security workflows, payments, service assignments, uploads, help lines, and sales/admin operations.

## Tech Stack

- Runtime: Node.js
- Web framework: Express 5
- Database: MongoDB through Mongoose
- Authentication: JSON Web Tokens with `Authorization: Bearer <token>`
- Password hashing: bcrypt
- Validation: Joi through `backend/middleware/validate.js`
- File uploads: Multer and Cloudinary storage
- QR generation: `qrcode`
- Optional cache/client scaffolding: Redis client helper
- Development package present: nodemon

## Repository Structure

- `backend/app.js`: Express app, global middleware, route mounting, 404 handler, error handler.
- `backend/server.js`: Loads environment variables, connects MongoDB, starts the HTTP server.
- `backend/config`: MongoDB and Cloudinary configuration.
- `backend/controllers`: HTTP request handlers. Most controllers delegate to services.
- `backend/services`: Business logic layer.
- `backend/repository`: Database query helpers for larger modules.
- `backend/models`: Mongoose schemas and model exports.
- `backend/routes`: Express route definitions and route-level middleware.
- `backend/middleware`: Auth, authorization, validation, uploads, rate limiting, and error handling.
- `backend/validation`: Joi request schemas.
- `backend/utils`: Shared helpers for errors, responses, pagination, dates, QR generation, search, roles, Redis, and Cloudinary uploads.
- `backend/seedDatabase.js`: Seed script for local/demo data.
- `AI_CONTEXT`: AI-readable project documentation and handoff state.

## Main Business Domains

- Platform administration: superadmin and salesperson creation, service catalog management, sales dashboards.
- Society setup: society creation, society code verification, onboarding drafts, wings, flats.
- User lifecycle: registration, login, OTP verification, full resident registration, approval/rejection, role updates.
- Resident operations: dashboard, notices, events, complaints, maintenance, expenses, funds, parking.
- Security operations: resident security status, visitor requests, staff management, staff attendance, alerts.
- Visitor entry: guest passes, visitor approvals, gate entry and exit logs.
- Support utilities: uploads, help line contacts, map/service visibility.

## Runtime Entry Points

- Start app: `node backend/server.js`
- Default port: `process.env.PORT || 5000`
- Root route: `GET /` returns `Welcome to society app backend`

## Environment Variables

The code references these variables. Never commit real secret values.

- `PORT`: HTTP server port.
- `MONGO_URI`: MongoDB connection string.
- `JWT_SECRET`: JWT signing and verification secret.
- `CLOUDINARY_NAME`: Cloudinary cloud name.
- `CLOUDINARY_KEY`: Cloudinary API key.
- `CLOUDINARY_SECRET`: Cloudinary API secret.
- `REDIS_URL`: referenced in `redisClient.js` comments/scaffold.

## Current Documentation Policy

`AI_CONTEXT` is the source of truth for AI handoff. After every feature, bug fix, refactor, API change, schema change, or architectural decision, update the relevant files in this folder before finishing the task.
