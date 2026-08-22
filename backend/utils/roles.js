// =======================================================
// ROLE VOCABULARY — SINGLE SOURCE OF TRUTH
//
// Two independent axes:
//   systemRole  — platform-wide. Only superadmin and salesperson
//                 legitimately act across societies.
//   societyRole — scoped to the user's own society.
//
// Every enum, middleware and route guard must import from here.
// Adding a role anywhere else will drift the two apart again.
// =======================================================

const SYSTEM_ROLES = {
  SUPERADMIN: "superadmin",
  SALESPERSON: "salesperson",
  USER: "user",
};

const SOCIETY_ROLES = {
  CHAIRMAN: "chairman",
  SECRETARY: "secretary",
  TREASURER: "treasurer",
  COMMITTEE_MEMBER: "committee_member",
  MEMBER: "member",
  SECURITY: "security",
};

const SYSTEM_ROLE_VALUES = Object.values(SYSTEM_ROLES);
const SOCIETY_ROLE_VALUES = Object.values(SOCIETY_ROLES);

// Roles that may administer a single society.
const SOCIETY_ADMINS = [
  SOCIETY_ROLES.CHAIRMAN,
  SOCIETY_ROLES.SECRETARY,
];

// Roles on the managing committee.
const COMMITTEE = [
  SOCIETY_ROLES.CHAIRMAN,
  SOCIETY_ROLES.SECRETARY,
  SOCIETY_ROLES.TREASURER,
  SOCIETY_ROLES.COMMITTEE_MEMBER,
];

// Anyone who lives in the society.
const RESIDENTS = [
  ...COMMITTEE,
  SOCIETY_ROLES.MEMBER,
];

// The only roles allowed to read across tenant boundaries.
const CROSS_TENANT = [
  SYSTEM_ROLES.SUPERADMIN,
  SYSTEM_ROLES.SALESPERSON,
];

// =======================================================
// LEGACY ALIASES
// Historic spellings that appear in existing documents and in
// old client payloads. Used by the migration script and by
// normaliseRole() so a stale value can never silently mean
// "no role" — which is how these bugs stayed invisible.
// =======================================================

const LEGACY_ALIASES = {
  "comitee-member": SOCIETY_ROLES.COMMITTEE_MEMBER,
  "comitee_member": SOCIETY_ROLES.COMMITTEE_MEMBER,
  "commitee_member": SOCIETY_ROLES.COMMITTEE_MEMBER,
  "committee-member": SOCIETY_ROLES.COMMITTEE_MEMBER,
  "guard": SOCIETY_ROLES.SECURITY,
  "admin": SOCIETY_ROLES.CHAIRMAN,
};

const normaliseRole = (role) => {

  if (!role) {
    return role;
  }

  const value = String(role).trim().toLowerCase();

  return LEGACY_ALIASES[value] || value;

};

module.exports = {
  //Flat constants. Route files reference ROLES.SECRETARY directly, and
  //nesting these under SOCIETY_ROLES silently turned every such guard
  //into requireSocietyRole(undefined), which denies everyone.
  ...SYSTEM_ROLES,
  ...SOCIETY_ROLES,

  SYSTEM_ROLES,
  SOCIETY_ROLES,
  SYSTEM_ROLE_VALUES,
  SOCIETY_ROLE_VALUES,
  SOCIETY_ADMINS,
  COMMITTEE,
  RESIDENTS,
  CROSS_TENANT,
  LEGACY_ALIASES,
  normaliseRole,
};
