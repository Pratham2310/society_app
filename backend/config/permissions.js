const { SOCIETY_ROLES, SYSTEM_ROLES } = require("../utils/roles");

// =======================================================
// PERMISSIONS
//
// Roles say who someone is; permissions say what they may do. The app
// asks for its own list at sign-in and hides any control it does not
// hold, so a button never appears that would come back 403.
//
// That only works while this file and the route guards agree, which is
// why both read from here rather than each spelling out roles.
//
// The split below is the one the app itself describes on the election
// screens, where each post is offered with a plain description of what
// it covers:
//
//   chairman          oversees everything, money included
//   secretary         administrative head: membership, records, appointments
//   treasurer         maintenance, expenses and funds
//   committee member  amenities, parking, complaints, events and the gate
// =======================================================

const PERMISSIONS = {

  MEMBERS_VIEW: "members.view",
  MEMBERS_APPROVE: "members.approve",
  MEMBERS_ROLES: "members.roles",

  ELECTIONS_MANAGE: "elections.manage",

  FINANCE_MANAGE: "finance.manage",
  FINANCE_VERIFY: "finance.verify",

  NOTICES_MANAGE: "notices.manage",
  EVENTS_MANAGE: "events.manage",
  AMENITIES_MANAGE: "amenities.manage",
  PARKING_MANAGE: "parking.manage",
  COMPLAINTS_MANAGE: "complaints.manage",
  HELPLINE_MANAGE: "helpline.manage",
  MAP_MANAGE: "map.manage",

  SECURITY_MANAGE: "security.manage",
  SECURITY_GATE: "security.gate",

  LOGS_VIEW: "logs.view",

};

const ALL = Object.values(PERMISSIONS);

// Every resident can see who else lives in the building. Everything
// beyond that is granted, never assumed.
const MEMBER = [
  PERMISSIONS.MEMBERS_VIEW,
];

const TREASURER = [
  ...MEMBER,
  PERMISSIONS.FINANCE_MANAGE,
  PERMISSIONS.FINANCE_VERIFY,
];

const COMMITTEE_MEMBER = [
  ...MEMBER,
  PERMISSIONS.AMENITIES_MANAGE,
  PERMISSIONS.PARKING_MANAGE,
  PERMISSIONS.COMPLAINTS_MANAGE,
  PERMISSIONS.EVENTS_MANAGE,
  PERMISSIONS.SECURITY_GATE,
];

const SECRETARY = [
  ...MEMBER,
  PERMISSIONS.MEMBERS_APPROVE,
  PERMISSIONS.MEMBERS_ROLES,
  PERMISSIONS.ELECTIONS_MANAGE,
  PERMISSIONS.NOTICES_MANAGE,
  PERMISSIONS.EVENTS_MANAGE,
  PERMISSIONS.AMENITIES_MANAGE,
  PERMISSIONS.PARKING_MANAGE,
  PERMISSIONS.COMPLAINTS_MANAGE,
  PERMISSIONS.HELPLINE_MANAGE,
  PERMISSIONS.MAP_MANAGE,
  PERMISSIONS.SECURITY_MANAGE,
  PERMISSIONS.SECURITY_GATE,
  PERMISSIONS.LOGS_VIEW,
];

// A guard works the gate and nothing else. They are staff, not a
// resident, so they do not get the member directory either.
const SECURITY = [
  PERMISSIONS.SECURITY_GATE,
];

const BY_SOCIETY_ROLE = {
  [SOCIETY_ROLES.CHAIRMAN]: ALL,
  [SOCIETY_ROLES.SECRETARY]: SECRETARY,
  [SOCIETY_ROLES.TREASURER]: TREASURER,
  [SOCIETY_ROLES.COMMITTEE_MEMBER]: COMMITTEE_MEMBER,
  [SOCIETY_ROLES.SECURITY]: SECURITY,
  [SOCIETY_ROLES.MEMBER]: MEMBER,
};

/**
 * What this user may do. Superadmins hold everything by definition —
 * they are the ones who set the roles in the first place.
 */
const permissionsFor = (user) => {

  if (!user) return [];

  if (user.systemRole === SYSTEM_ROLES.SUPERADMIN) {
    return [...ALL];
  }

  const granted = BY_SOCIETY_ROLE[user.societyRole];

  // An unrecognised role gets nothing rather than a default set. A role
  // that was renamed and missed here should lock its holder out
  // visibly, not quietly hand them a member's permissions.
  return granted ? [...granted] : [];

};

const has = (user, permission) => permissionsFor(user).includes(permission);

module.exports = {
  PERMISSIONS,
  ALL,
  BY_SOCIETY_ROLE,
  permissionsFor,
  has,
};
