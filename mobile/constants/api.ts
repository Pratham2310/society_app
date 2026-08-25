import Constants from 'expo-constants';

function getBaseUrl(): string {
  // Extract IP from Expo Go's dev server connection.
  // When the phone runs the app, Expo Go already has the machine's LAN IP
  // (it used it to download the bundle). We grab port 5000 from the same IP.
  const hostUri: string =
    (Constants.expoGoConfig as any)?.hostUri ??                // Expo Go SDK 50+
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ?? // dev build
    (Constants as any).manifest?.debuggerHost ??              // older SDK
    '';

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      const url = `http://${host}:5000`;
      console.log('[API] Backend URL (auto):', url);
      return url;
    }
  }

  // Fallback: explicit env var
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    console.log('[API] Backend URL (env):', envUrl);
    return envUrl;
  }

  // Last resort — Android emulator
  console.log('[API] Backend URL (emulator fallback)');
  return 'http://10.0.2.2:5000';
}

export const BASE_URL = getBaseUrl();

// A hosted backend that has been idle spins its instance down, and the next
// request has to wait for it to boot — routinely 30s+. The old 15s ceiling
// turned that cold start into a guaranteed failure (and, on screens that
// swallowed the error, a spinner that never stopped).
const TIMEOUT_MS = 45_000;

export async function apiFetch(
  url: string,
  options: RequestInit = {},
  token?: string,
  timeoutMs: number = TIMEOUT_MS
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    const json = await res.json();
    if (!res.ok) {
      // Carry the HTTP status on the Error so callers can branch on it
      // (401 vs 403 vs 500) instead of pattern-matching the message text.
      const err: any = new Error(json.message || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return json;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      const e: any = new Error('Request timed out. Backend may be unreachable.');
      e.status = 0;
      throw e;
    }
    if (err.status === undefined) err.status = 0; // network / DNS / CORS failure
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const API = {
  SEND_OTP:       `${BASE_URL}/api/auth/send-otp`,
  VERIFY_OTP:     `${BASE_URL}/api/auth/verify-otp`,
  LOGIN:          `${BASE_URL}/api/auth/login`,
  FORGOT_PASSWORD: `${BASE_URL}/api/auth/forgot-password`,
  RESET_PASSWORD:  `${BASE_URL}/api/auth/reset-password`,

  VERIFY_CODE:    `${BASE_URL}/api/societies/verify-code`,
  // The caller's own society — carries the real UPI/payee details residents
  // pay into, set by their secretary or treasurer.
  MY_SOCIETY:          `${BASE_URL}/api/societies/me`,
  MY_SOCIETY_PAYMENT:  `${BASE_URL}/api/societies/me/payment`,

  WINGS:          (societyId: string) => `${BASE_URL}/api/wings/society/${societyId}`,
  FLOORS:         (wingId: string)    => `${BASE_URL}/api/flats/floors/${wingId}`,
  FLATS:          (wingId: string, floor: string) => `${BASE_URL}/api/flats?wingId=${wingId}&floor=${floor}`,

  REGISTER_FULL:    `${BASE_URL}/api/users/register-full`,
  ALL_USERS:        `${BASE_URL}/api/users/all-users`,
  PENDING_USERS:    `${BASE_URL}/api/users/pending-users`,
  UPDATE_MEMBER_STATUS: (userId: string) => `${BASE_URL}/api/users/update-status/${userId}`,

  MY_VEHICLES:    `${BASE_URL}/api/users/me/vehicles`,
  MY_VEHICLE:     (id: string) => `${BASE_URL}/api/users/me/vehicles/${id}`,
  ME:             `${BASE_URL}/api/users/me`,
  MY_PERMISSIONS: `${BASE_URL}/api/users/me/permissions`,
  UPDATE_MEMBER_ROLE: (userId: string) => `${BASE_URL}/api/users/update-role/${userId}`,
  ME_PROFILE:     `${BASE_URL}/api/users/me/profile`,
  ME_AVATAR:      `${BASE_URL}/api/users/me/avatar`,
  PUSH_TOKEN:     `${BASE_URL}/api/users/me/push-token`,
  WEB_PUSH:       `${BASE_URL}/api/users/me/web-push`,
  WEB_PUSH_KEY:   `${BASE_URL}/api/users/web-push-key`,
  PROFILE_CHANGE_REQUESTS: `${BASE_URL}/api/users/profile-change-requests`,
  PROFILE_CHANGE_DECIDE:   (userId: string) => `${BASE_URL}/api/users/profile-change-requests/${userId}`,

  DASHBOARD:      `${BASE_URL}/api/residents/dashboard`,
  NOTICES:        `${BASE_URL}/api/notices`,
  UPLOAD:         `${BASE_URL}/api/uploads/upload`,
  EVENTS:         `${BASE_URL}/api/events`,
  COMPLAINTS:     `${BASE_URL}/api/complaints`,
  NOTIFICATIONS:  `${BASE_URL}/api/notifications`,
  NOTIFICATION_READ: (id: string) => `${BASE_URL}/api/notifications/${id}/read`,
  PARKING_SUMMARY: `${BASE_URL}/api/parking/summary`,
  PARKING_SLOTS:       `${BASE_URL}/api/parking/slots`,
  PARKING_SLOTS_BATCH: `${BASE_URL}/api/parking/slots/batch`,
  PARKING_SLOT:        (id: string) => `${BASE_URL}/api/parking/slots/${id}`,

  NOTICE:              (id: string) => `${BASE_URL}/api/notices/${id}`,
  NOTICE_ACK:          (id: string) => `${BASE_URL}/api/notices/${id}/acknowledge`,
  COMPLAINT:           (id: string) => `${BASE_URL}/api/complaints/${id}`,
  COMPLAINT_STATUS:    (id: string) => `${BASE_URL}/api/complaints/${id}/status`,
  EVENT:               (id: string) => `${BASE_URL}/api/events/${id}`,
  EVENT_RSVP:          (id: string) => `${BASE_URL}/api/events/${id}/rsvp`,
  EVENT_PAY:           (id: string) => `${BASE_URL}/api/events/${id}/pay`,
  // Who paid for THIS event — distinct from the society-wide fund donor wall.
  EVENT_CONTRIBUTORS:  (id: string) => `${BASE_URL}/api/events/${id}/contributors`,

  FINANCE_OVERVIEW:    `${BASE_URL}/api/finance/overview`,
  MAINTENANCE:         `${BASE_URL}/api/finance/maintenance`,
  MAINTENANCE_AMOUNT:  `${BASE_URL}/api/finance/maintenance/amount`,
  MAINTENANCE_REMINDERS: `${BASE_URL}/api/finance/maintenance/reminders`,
  MAINTENANCE_HUB:     `${BASE_URL}/api/finance/maintenance/hub`,
  EXPENSES:            `${BASE_URL}/api/finance/expenses`,
  EXPENSE:             (id: string) => `${BASE_URL}/api/finance/expenses/${id}`,
  FUND_CAMPAIGNS:      `${BASE_URL}/api/finance/campaigns`,
  FUND_CAMPAIGN:       (id: string) => `${BASE_URL}/api/finance/campaigns/${id}`,
  CONTRIBUTORS:        `${BASE_URL}/api/finance/contributors`,
  FUND_CONTRIBUTIONS:  `${BASE_URL}/api/finance/contributions`,
  CONTRIBUTION_RECEIPT: (id: string) => `${BASE_URL}/api/finance/contributions/${id}/receipt`,
  FUND_CONTRIBUTIONS_LIST: (fundId: string) => `${BASE_URL}/api/finance/campaigns/${fundId}/contributions`,
  CONTRIBUTION_VERIFY: (id: string) => `${BASE_URL}/api/finance/contributions/${id}/verify`,

  // Amenities & bookings (see backend/routes/amenityRoutes.js)
  AMENITIES:               `${BASE_URL}/api/amenities`,
  AMENITY:                 (id: string) => `${BASE_URL}/api/amenities/${id}`,
  AMENITY_BOOKINGS:        (id: string, date?: string) =>
    `${BASE_URL}/api/amenities/${id}/bookings${date ? `?date=${date}` : ''}`,
  AMENITY_BOOK:            (id: string) => `${BASE_URL}/api/amenities/${id}/bookings`,
  MY_AMENITY_BOOKINGS:     `${BASE_URL}/api/amenities/bookings/mine`,
  PENDING_AMENITY_BOOKINGS: `${BASE_URL}/api/amenities/bookings/pending`,
  AMENITY_BOOKING_DECIDE:  (bookingId: string) => `${BASE_URL}/api/amenities/bookings/${bookingId}/decision`,
  AMENITY_BOOKING_CANCEL:  (bookingId: string) => `${BASE_URL}/api/amenities/bookings/${bookingId}`,

  // Committee elections (see backend/routes/electionRoutes.js)
  ELECTIONS:               `${BASE_URL}/api/elections`,
  ELECTION:                (id: string) => `${BASE_URL}/api/elections/${id}`,
  ELECTION_CANCEL:         (id: string) => `${BASE_URL}/api/elections/${id}/cancel`,
  ELECTION_CANDIDATES:     (id: string) => `${BASE_URL}/api/elections/${id}/candidates`,
  ELECTION_CANDIDATE:      (id: string, candidateId: string) =>
    `${BASE_URL}/api/elections/${id}/candidates/${candidateId}`,
  ELECTION_VOTE:           (id: string) => `${BASE_URL}/api/elections/${id}/vote`,
  ELECTION_CLOSE:          (id: string) => `${BASE_URL}/api/elections/${id}/close`,

  // Helpline (see backend/routes/helpRoutes.js)
  HELPLINE:            `${BASE_URL}/api/helpline`,
  HELPLINE_ITEM:       (id: string) => `${BASE_URL}/api/helpline/${id}`,

  // Nearby businesses the platform has onboarded for this society
  NEARBY_SERVICES:     `${BASE_URL}/api/partner-services/mine`,

  // Society map (see backend/routes/mapRoutes.js)
  MAP:                 `${BASE_URL}/api/map`,
  MAP_CATALOG:         `${BASE_URL}/api/map/catalog`,
  MAP_ITEM:            (id: string) => `${BASE_URL}/api/map/${id}`,

  // Security module (see backend/routes/securityRoutes.js)
  SECURITY_STATUS_ME:  `${BASE_URL}/api/security/status/me`,
  SECURITY_STATUS_SET: `${BASE_URL}/api/security/status/me`,
  SECURITY_PANIC:      `${BASE_URL}/api/security/status/panic`,
  SECURITY_SAFE:       `${BASE_URL}/api/security/status/safe`,
  SECURITY_ALERTS:     `${BASE_URL}/api/security/alerts`,
  SECURITY_VISITORS:   (scope: 'mine' | 'today' | 'society' = 'mine') =>
    `${BASE_URL}/api/security/visitors?scope=${scope}`,
  SECURITY_ALERT_ACK:     (id: string) => `${BASE_URL}/api/security/alerts/${id}/acknowledge`,
  SECURITY_ALERT_RESOLVE: (id: string) => `${BASE_URL}/api/security/alerts/${id}/resolve`,
  SECURITY_VISITOR_CREATE: `${BASE_URL}/api/security/visitors`,
  SECURITY_VISITOR_ENTRY: (id: string) => `${BASE_URL}/api/security/visitors/${id}/entry`,
  SECURITY_VISITOR_EXIT:  (id: string) => `${BASE_URL}/api/security/visitors/${id}/exit`,
  SECURITY_VISITOR_BY_ID:  (id: string) => `${BASE_URL}/api/security/visitors/${id}`,
  // Gate-pass QR system
  SECURITY_VISITOR_PASS:   (id: string) => `${BASE_URL}/api/security/visitors/${id}/pass`,
  SECURITY_VISITOR_SCAN:   `${BASE_URL}/api/security/visitors/scan`,
  SECURITY_VISITOR_APPROVE: (id: string) => `${BASE_URL}/api/security/visitors/${id}/approve`,
  SECURITY_VISITOR_DELETE: (id: string) => `${BASE_URL}/api/security/visitors/${id}`,
  // Staff management
  SECURITY_ATTENDANCE_MARK: `${BASE_URL}/api/security/attendance`,
  SECURITY_ATTENDANCE_TODAY: `${BASE_URL}/api/security/attendance`,
  SECURITY_STAFF:      `${BASE_URL}/api/security/staff?active=true`,
  SECURITY_STAFF_CREATE: `${BASE_URL}/api/security/staff`,
  SECURITY_STAFF_BY_ID: (id: string) => `${BASE_URL}/api/security/staff/${id}`,
  // Household staff: a resident's own maid/cook, approved by the secretary
  HOUSEHOLD_STAFF_ADD:     `${BASE_URL}/api/security/staff/household`,
  HOUSEHOLD_STAFF_PENDING: `${BASE_URL}/api/security/staff/household/pending`,
  HOUSEHOLD_STAFF_DECIDE:  (id: string) => `${BASE_URL}/api/security/staff/${id}/approval`,
  STAFF_PASS:              (id: string) => `${BASE_URL}/api/security/staff/${id}/pass`,
  SECURITY_ON_DUTY:        `${BASE_URL}/api/security/on-duty`,
  SECURITY_STAFF_UPDATE: (id: string) => `${BASE_URL}/api/security/staff/${id}`,
  SECURITY_STAFF_DELETE: (id: string) => `${BASE_URL}/api/security/staff/${id}`,
  SECURITY_ASSIGNMENTS: `${BASE_URL}/api/security/assignments`,
  SECURITY_ATTENDANCE: (staffId: string) =>
    `${BASE_URL}/api/security/attendance?staffId=${staffId}`,
  SECURITY_ATTENDANCE_REPORT: (month: number, year: number) =>
    `${BASE_URL}/api/security/attendance/report?month=${month}&year=${year}`,
};
