# API Reference

Last updated: 2026-07-13

Base URL in development: `http://localhost:5000`

Unless stated otherwise, protected endpoints expect:

```http
Authorization: Bearer <jwt>
Content-Type: application/json
```

Standard success responses are JSON. Some modules use `{ success, message, data }`; others return direct domain keys such as `{ token, user }`.

## Public And Auth

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` | No | Health/welcome text. |
| POST | `/api/auth/register` | No | Register user. Joi currently requires `name`, `email`, `password`, and `role`. |
| POST | `/api/auth/login` | No | Login with `identifier` and `password`; validation accepts email or 10-digit phone. |
| POST | `/api/auth/send-otp` | No | Send OTP to `phone`. |
| POST | `/api/auth/verify-otp` | No | Verify `phone` and `otp`. |
| POST | `/api/societies/verify-code` | No | Verify a society code. |

Known auth mismatch: login validation accepts `identifier`, but service currently queries by email. Register controller/service argument shape also needs review.

## Admin And Sales

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/admin/create-salesperson` | Superadmin | Create salesperson. |
| POST | `/api/admin/create-superadmin` | No route auth | Create superadmin. |
| GET | `/api/sales/dashboard` | Salesperson | Sales dashboard. |
| GET | `/api/sales/societies` | Salesperson | Society list. |
| GET | `/api/sales/society/:id` | Salesperson | Society details. |
| GET | `/api/sales/society/:id/residents` | Salesperson | Resident preview/list data. |
| GET | `/api/sales/society/:id/security` | Salesperson | Security personnel data. |
| GET | `/api/sales/society/:id/staff` | Salesperson | Staff preview. |
| GET | `/api/sales/society/:id/staff/all` | Salesperson | All staff. |
| GET | `/api/sales/society/:id/leadership` | Salesperson | Society leadership. |
| GET | `/api/sales/society/:id/services` | Salesperson | Service data. |

## Society Setup

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/societies` | Superadmin or salesperson | Create society. |
| POST | `/api/onboarding/step1` | Salesperson | Save onboarding step 1. |
| POST | `/api/onboarding/step2` | Salesperson | Save onboarding step 2. |
| POST | `/api/onboarding/step3` | Salesperson | Save onboarding step 3. |
| POST | `/api/onboarding/step4` | Salesperson | Save onboarding step 4. |
| POST | `/api/onboarding/finalize` | Salesperson | Finalize onboarding. |
| POST | `/api/wings` | Superadmin or salesperson | Create wing. |
| GET | `/api/wings/society/:societyId` | Superadmin or salesperson | Get wings by society. |
| GET | `/api/wings/:id` | Superadmin or salesperson | Get wing by ID. |
| GET | `/api/flats` | Protected | Get flats. |
| GET | `/api/flats/floors/:wingId` | Protected | Get floor data. |
| GET | `/api/flats/wing/:wingId` | Protected | Get flats by wing. |
| POST | `/api/flats` | Superadmin or salesperson | Create flat. |
| POST | `/api/flats/bulk` | Superadmin or salesperson | Bulk create flats. |

## Users

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/users/register-full` | No route auth | Full resident registration. |
| GET | `/api/users/pending-users` | Secretary | List pending users. |
| PUT | `/api/users/update-status/:userId` | Secretary or chairman | Approve/reject user status. |
| GET | `/api/users/all-users` | Protected | List all users in context. |
| GET | `/api/users/user-by-wing/:wingId` | Protected | Users by wing. |
| PUT | `/api/users/update-role/:userId` | Secretary | Update society role. |

## Resident Operations

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/residents/dashboard` | Approved user | Resident dashboard. |
| POST | `/api/notices` | Approved committee role | Create notice. |
| GET | `/api/notices` | Approved user | List notices. |
| GET | `/api/notices/:id` | Approved user | Get notice. |
| PUT | `/api/notices/:id` | Approved committee role | Update notice. |
| DELETE | `/api/notices/:id` | Approved committee role | Delete notice. |
| POST | `/api/events` | Approved committee role | Create event. |
| GET | `/api/events` | Approved user | List events. |
| GET | `/api/events/:id` | Approved user | Get event. |
| PUT | `/api/events/:id` | Approved committee role | Update event. |
| DELETE | `/api/events/:id` | Approved committee role | Delete event. |
| POST | `/api/complaints` | Approved user | Create complaint. |
| GET | `/api/complaints` | Approved user | List complaints. |
| GET | `/api/complaints/:id` | Approved user | Get complaint. |
| PUT | `/api/complaints/:id/status` | Approved user | Update complaint status. |

## Finance

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/maintenance/my` | Approved user | Current user's bills. |
| POST | `/api/maintenance/generate` | Approved user | Generate maintenance bills. |
| GET | `/api/maintenance` | Approved user | List bills. |
| PUT | `/api/maintenance/:id/pay` | Approved user | Mark bill paid. |
| PUT | `/api/maintenance/:id/pending` | Approved user | Mark bill pending. |
| POST | `/api/maintenance/:id/reminder` | Approved user | Send reminder. |
| POST | `/api/payments/maintenance/:billId` | Chairman, secretary, or committee member | Record maintenance payment. |
| POST | `/api/expenses` | Approved user | Create expense. |
| PUT | `/api/expenses/:id/publish` | Approved user | Publish expense. |
| PUT | `/api/expenses/:id/visibility` | Approved user | Toggle expense visibility. |
| GET | `/api/expenses` | Approved user | List expenses. |
| POST | `/api/community-funds` | Secretary | Create fund. |
| GET | `/api/community-funds` | Approved user | List funds. |
| POST | `/api/community-funds/:id/contribute` | Approved user | Add contribution. |
| PUT | `/api/community-funds/contribution/:id` | Approved user | Approve/reject contribution. |

## Parking

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/parking/map` | Approved user | Parking map. |
| GET | `/api/parking/my` | Approved user | Current user's parking. |
| GET | `/api/parking/find-owner` | Approved user | Find vehicle owner. |
| GET | `/api/parking/slot/:id` | Approved user | Slot details. |
| POST | `/api/parking/slot` | Approved user | Create slot. |
| PUT | `/api/parking/assign/:id` | Approved user | Assign slot. |
| PUT | `/api/parking/free/:id` | Approved user | Free slot. |

## Security, Guests, And Visitors

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/security/status` | Approved user | Get resident security status. |
| PUT | `/api/security/status` | Approved user | Update status. |
| POST | `/api/security/visitor` | Approved user | Create visitor request. |
| GET | `/api/security/visitor` | Approved user | List visitor requests. |
| PUT | `/api/security/visitor/:id/approve` | Approved user | Approve visitor. |
| PUT | `/api/security/visitor/:id/reject` | Approved user | Reject visitor. |
| PUT | `/api/security/visitor/:id/fraud` | Approved user | Report fraud. |
| POST | `/api/security/staff` | Approved user | Add staff. |
| GET | `/api/security/staff` | Approved user | List staff. |
| PUT | `/api/security/staff/:id/approve` | Approved user | Approve staff. |
| PUT | `/api/security/staff/:id/reject` | Approved user | Reject staff. |
| PUT | `/api/security/staff/:id/block` | Approved user | Block staff. |
| PUT | `/api/security/staff/remove/:id` | Approved user | Remove staff assignment. |
| POST | `/api/security/attendance/entry` | Approved user | Mark staff entry. |
| PUT | `/api/security/attendance/exit/:id` | Approved user | Mark staff exit. |
| GET | `/api/security/attendance` | Approved user | Attendance history. |
| POST | `/api/security/alerts` | Approved user | Create alert. |
| GET | `/api/security/alerts` | Approved user | List alerts. |
| PUT | `/api/security/alerts/:id/resolve` | Approved user | Resolve alert. |
| POST | `/api/guest-passes` | Resident/committee role | Create guest pass. |
| PATCH | `/api/guest-passes/:guestPassId/extend` | Resident/committee role | Extend guest pass. |
| PATCH | `/api/guest-passes/:guestPassId/cancel` | Resident/committee role | Cancel guest pass. |
| GET | `/api/guest-passes/:guestPassId` | Guard | Get guest pass. |
| PATCH | `/api/guest-passes/:guestPassId/regenerate` | Guard | Regenerate QR. |
| GET | `/api/guest-passes/society` | Committee role | Society guest passes. |
| GET | `/api/guest-passes/statistics` | Committee role | Guest pass stats. |
| PATCH | `/api/guest-passes/:guestPassId/approve` | Chairman or secretary | Approve guest pass. |
| PATCH | `/api/guest-passes/:guestPassId/archive` | Admin | Archive guest pass. |
| POST | `/api/gate-log/scan-entry` | Guard | Scan visitor entry. |
| POST | `/api/gate-log/scan-exit` | Guard | Scan visitor exit. |
| GET | `/api/gate-log/society` | Committee role | Society gate logs. |
| GET | `/api/gate-log/guest/:guestPassId` | Committee role | Guest visit history. |
| GET | `/api/gate-log/today` | Committee role | Today's logs. |
| GET | `/api/gate-log/statistics` | Admin | Gate log statistics. |
| POST | `/api/visitor-approvals` | Guard | Request approval. |
| PATCH | `/api/visitor-approvals/:approvalId/cancel` | Guard | Cancel request. |
| GET | `/api/visitor-approvals/pending` | Guard | Guard pending requests. |
| GET | `/api/visitor-approvals/resident/pending` | Resident/chairman | Resident pending requests. |
| PATCH | `/api/visitor-approvals/:approvalId/approve` | Resident/chairman | Approve request. |
| PATCH | `/api/visitor-approvals/:approvalId/reject` | Resident/chairman | Reject request. |

`visitorApprovalRoutes.js` contains misspelled controller references for committee routes, so those routes are currently documented as intended but should be fixed before use.

## Services, Map, Help, Uploads

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/services` | Salesperson | Create service. |
| GET | `/api/services` | Salesperson | List services. |
| PUT | `/api/services/:id` | Salesperson | Update service. |
| POST | `/api/services/:id/assign` | Salesperson | Assign service to society. |
| POST | `/api/services/:id/unassign` | Salesperson | Unassign service. |
| GET | `/api/services/:id/societies` | Salesperson | Linked societies. |
| GET | `/api/map/services` | Approved user | Society services map/list. |
| GET | `/api/map/services/:id` | Approved user | Service details. |
| PATCH | `/api/map/services/:id/toggle` | Approved user | Intended toggle visibility route; code currently misses leading slash. |
| POST | `/api/help` | Approved user | Create helpline. |
| GET | `/api/help` | Approved user | List helplines. |
| PUT | `/api/help/:id` | Approved user | Update helpline. |
| DELETE | `/api/help/:id` | Approved user | Delete helpline. |
| POST | `/api/uploads/upload` | No route auth | Upload single `file` to Cloudinary via multer. |

## Error Responses

Global error handler returns:

```json
{
  "success": false,
  "message": "Error message"
}
```

Duplicate Mongo keys return status `400` with a field-specific message. Joi validation errors return status `400` with the first validation message. Auth middleware returns `401` for missing, malformed, invalid, or expired tokens.
