/**
 * The single source of truth for registration field rules on the client.
 *
 * These MUST mirror `backend/validation/userValidation.js :: registerFullSchema`.
 * When the two drift, the resident fills in a field the app accepts, walks all
 * the way to step 4, and only then gets a Joi rejection for something they typed
 * on step 1 — with no way to tell which field is at fault. Every limit below is
 * copied from that schema; change them together.
 */

export const LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 60,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 64,
  PHONE_DIGITS: 10,
  FLAT_NUMBER_MAX: 20,
  FAMILY_SIZE_MIN: 1,
  FAMILY_SIZE_MAX: 20,
  VEHICLE_NUMBER_MIN: 4,
  VEHICLE_NUMBER_MAX: 15,
  VEHICLES_MAX: 5,
} as const;

/** Every validator returns an error string to show, or null when the value is good. */
export type FieldError = string | null;

export const validateName = (raw: string): FieldError => {
  const name = raw.trim();
  if (!name) return 'Full name is required';
  if (name.length < LIMITS.NAME_MIN) return `Name must be at least ${LIMITS.NAME_MIN} characters`;
  if (name.length > LIMITS.NAME_MAX) return `Name must be under ${LIMITS.NAME_MAX} characters`;
  return null;
};

export const validateEmail = (raw: string): FieldError => {
  const email = raw.trim();
  if (!email) return 'Email address is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  return null;
};

export const validatePassword = (password: string): FieldError => {
  if (!password) return 'Password is required';
  if (password.length < LIMITS.PASSWORD_MIN) {
    return `Password must be at least ${LIMITS.PASSWORD_MIN} characters`;
  }
  if (password.length > LIMITS.PASSWORD_MAX) {
    return `Password must be under ${LIMITS.PASSWORD_MAX} characters`;
  }
  return null;
};

export const validatePhone = (phone: string): FieldError => {
  if (!phone) return 'Mobile number is required';
  if (!new RegExp(`^[0-9]{${LIMITS.PHONE_DIGITS}}$`).test(phone)) {
    return `Enter a valid ${LIMITS.PHONE_DIGITS}-digit mobile number`;
  }
  return null;
};

/**
 * Plates are typed with spaces and hyphens ("MH 12 AB 1234") far more often than
 * not. The backend counts those characters against its 15-char ceiling, so
 * normalise before measuring — otherwise a perfectly ordinary plate is rejected
 * on the final screen for being "too long".
 */
export const normalizeVehicleNumber = (raw: string) =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const validateVehicleNumber = (raw: string): FieldError => {
  const number = normalizeVehicleNumber(raw);
  if (!number) return 'Vehicle number is required';
  if (number.length < LIMITS.VEHICLE_NUMBER_MIN) {
    return `Vehicle number must be at least ${LIMITS.VEHICLE_NUMBER_MIN} characters`;
  }
  if (number.length > LIMITS.VEHICLE_NUMBER_MAX) {
    return `Vehicle number must be under ${LIMITS.VEHICLE_NUMBER_MAX} characters`;
  }
  return null;
};

export const validateFamilySize = (size: number): FieldError => {
  if (!Number.isInteger(size)) return 'Family size must be a whole number';
  if (size < LIMITS.FAMILY_SIZE_MIN) return `Family size must be at least ${LIMITS.FAMILY_SIZE_MIN}`;
  if (size > LIMITS.FAMILY_SIZE_MAX) return `Family size cannot be more than ${LIMITS.FAMILY_SIZE_MAX}`;
  return null;
};
