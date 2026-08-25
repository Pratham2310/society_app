/**
 * Shared vocabulary for the election screens.
 *
 * The post keys and the status names both come from the backend
 * (models/Election.js and services/electionService.statusOf) — kept in one
 * place here so the list and detail screens cannot drift apart.
 */

export type ElectionStatus =
  | 'scheduled'
  | 'open'
  | 'awaiting_count'
  | 'completed'
  | 'cancelled';

export const POSTS = [
  {
    key: 'chairman',
    label: 'Chairman',
    single: true,
    blurb: 'Oversees everything, money included.',
  },
  {
    key: 'secretary',
    label: 'Secretary',
    single: true,
    blurb: 'Administrative head — membership, records and appointments.',
  },
  {
    key: 'treasurer',
    label: 'Treasurer',
    single: true,
    blurb: 'Maintenance, expenses and funds.',
  },
  {
    key: 'committee_member',
    label: 'Committee Member',
    single: false,
    blurb: 'Amenities, parking, complaints, events and the gate.',
  },
] as const;

export const postLabel = (key: string) =>
  POSTS.find((p) => p.key === key)?.label ?? key.replace(/_/g, ' ');

export const POST_COLOR: Record<string, string> = {
  chairman: '#6d28d9',
  secretary: '#922207',
  treasurer: '#1d7a3a',
  committee_member: '#b45309',
};

export const STATUS_META: Record<ElectionStatus, { label: string; color: string; bg: string }> = {
  scheduled:      { label: 'OPENS SOON',    color: '#b45309', bg: '#FEF3C7' },
  open:           { label: 'VOTING OPEN',   color: '#1d7a3a', bg: '#eaf6ee' },
  awaiting_count: { label: 'AWAITING COUNT', color: '#6d28d9', bg: '#EDE9FE' },
  completed:      { label: 'RESULT OUT',    color: '#334155', bg: '#E2E8F0' },
  cancelled:      { label: 'CANCELLED',     color: '#991B1B', bg: '#FEF2F2' },
};

/** "18 Aug 2026" — the format used across the rest of the app. */
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** How long is left, said the way a person would say it. */
export function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * A YYYY-MM-DD date turned into the moment voting starts or ends on that day.
 * A society runs a vote over whole days, so the screens ask for dates only.
 */
export const dayStart = (key: string) => `${key}T00:00:00`;
export const dayEnd = (key: string) => `${key}T23:59:59`;
