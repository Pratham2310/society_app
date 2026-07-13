# Database

Last updated: 2026-07-13

## Database Technology

The backend uses MongoDB with Mongoose models in `backend/models`.

## Core Collections And Models

### User

Fields include `name`, unique indexed `email`, `password`, required `phone`, `systemRole`, `societyRole`, onboarding and approval flags, occupancy/living details, vehicles, society/wing/flat references, OTP fields, staff category, and entry time. References `Society`, `Wing`, and `Flat`.

Important enums:

- `systemRole`: `superadmin`, `salesperson`, `user`
- `societyRole`: `chairman`, `secretary`, `treasurer`, `commitee_member`, `member`, `security`
- `status`: `pending`, `approved`, `rejected`

### Society

Fields include `name`, address details, `hasWingStructure`, `totalWings`, unique required `societyCode`, `status`, `subscriptionPlan`, and `createdBy`. Unique compound index on `name` and `address`.

### Wing

Fields include `name`, `societyId`, floor and flat metadata. Unique compound index on `name` and `societyId`.

### Flat

Fields include `societyId`, `wingId`, `flatNumber`, `floor`, occupancy data, and status. Unique compound index for flat identity within society/wing.

### Notice, Event, Complaint

These models support society communication and issue management. They reference `Society`, `User`, and optionally `Wing`; they include status/visibility/audience fields and timestamps.

### MaintenanceBill, Payment

Maintenance bills reference society, user, and optional payment. Payments reference society, user, maintenance bills or contributions, amount, method/type/status, and collector.

### Expense, CommunityFund, Contribution, Fund

Expense and fund models track society finance. Community funds have contribution records and approval workflow.

### ParkingSlot, ParkingAllotment

Parking slots belong to societies and optionally wings. Slots have unique society-level slot numbers. Allotments map active slots to flats, vehicles, and users, with a unique active allotment index per slot and an index on `vehicleNumber`.

### Security Models

- `ResidentSecurityStatus`: one status document per resident/society intent, but both resident and society fields are marked unique individually.
- `VisitorRequest`: visitor workflow with pending/approved/rejected/fraud/expired statuses.
- `StaffProfile`: staff master data.
- `StaffAssignment`: assignment of staff to users/societies.
- `StaffAttendance`: entry and exit history.
- `SecurityAlert`: alert records tied to societies and optionally users or visitor requests.

### GuestPass, GateLog, VisitorApproval

These support QR-based visitor entry and approval workflows. They reference society, resident/user, flat, wing, guard/user actors, and include rich status, approval, cancellation, archive, and scan metadata. Several indexes exist for reporting and lookup.

### Service, SocietyService

`Service` stores platform-level services. `SocietyService` links services to societies and has a unique service/society assignment index.

### Other Models

- `Announcement`
- `Draft`
- `Helpline`
- `Invite`
- `Notification`
- `Visitor`

## Relationships

- A society has many wings, flats, users, notices, events, expenses, funds, maintenance bills, parking slots, staff records, and security records.
- A wing belongs to one society and can have many flats.
- A flat belongs to a society and usually a wing.
- A user may belong to a society, wing, and flat.
- Payments may settle maintenance bills or fund contributions.
- Guest passes, gate logs, and visitor approvals connect residents, guards, flats, wings, and societies.

## Constraints And Indexes

- `User.email` is unique and indexed.
- `Society.societyCode` is unique.
- `Society` has a unique compound index on `name` and `address`.
- `Wing` has a unique compound index on `name` and `societyId`.
- `Flat` has a unique compound index for flat number under its society/wing.
- `ParkingSlot` has a unique compound index for slot number inside a society.
- `ParkingAllotment` has a unique active slot allotment index and a `vehicleNumber` index.
- `SocietyService` has a unique service/society assignment index.
- Guest pass, gate log, and visitor approval models define multiple lookup/reporting indexes.

## Schema Risks

- Role spelling is inconsistent across models and middleware.
- Some references use model names that may not match exported collection names exactly, for example `CommunityFund` reference versus `mongoose.model("communityFund", ...)`.
- `ResidentSecurityStatus` marks both resident and society references as unique, which may prevent multiple residents in the same society from having separate status records.
- Some model comments contain encoding artifacts from prior edits.
