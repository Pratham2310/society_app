const { AsyncLocalStorage } = require("node:async_hooks");

// =======================================================
// TENANT CONTEXT
//
// Carries the caller's societyId for the lifetime of a request
// without threading it through every function signature.
//
// The societyScope Mongoose plugin reads this to constrain
// queries automatically, so a repository that forgets to filter
// by societyId still cannot reach another society's data.
// =======================================================

const storage = new AsyncLocalStorage();

// Run `fn` with a tenant context bound to the current async chain.
const runWithTenant = (context, fn) => storage.run(context, fn);

const getTenant = () => storage.getStore();

// Cross-tenant callers (superadmin, salesperson) and background
// scripts run without a societyId constraint.
const isCrossTenant = () => Boolean(storage.getStore()?.crossTenant);

const getSocietyId = () => storage.getStore()?.societyId;

// Escape hatch for code that legitimately needs to read across
// societies inside a request — must be explicit at the call site.
const runUnscoped = (fn) =>
  storage.run({ ...(storage.getStore() || {}), crossTenant: true }, fn);

module.exports = {
  runWithTenant,
  runUnscoped,
  getTenant,
  getSocietyId,
  isCrossTenant,
};
