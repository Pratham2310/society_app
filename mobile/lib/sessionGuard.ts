import { BASE_URL } from '../constants/api';

/**
 * Sign the user out when the server says their session is over.
 *
 * Tokens last 7 days. When one expired, nothing in the app noticed: every
 * screen caught its own error and showed "Invalid or expired token" beside a
 * Retry button that re-sent the same dead token, so it could never succeed.
 * The only way out was to find Profile and log out by hand.
 *
 * The check sits on global fetch rather than in apiFetch because only 16 of the
 * 47 API call sites go through apiFetch — the rest call fetch directly, and the
 * members screen (where this was reported) is one of them. Wrapping fetch once
 * covers every one of them without editing 31 files.
 */

let onExpired: (() => void) | null = null;
let installed = false;
// A dead token usually produces several 401s at once, as every screen in view
// refetches. Fire the sign-out for the first one only.
let handling = false;

/** AuthContext registers its logout here. */
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onExpired = fn;
}

export function installSessionGuard() {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;

  const original = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: any, init?: any) => {
    const res = await original(input, init);

    try {
      const url = typeof input === 'string' ? input : input?.url ?? '';

      // Only our own API, and only when a token was actually sent — a 401 from
      // the login endpoint means "wrong password", not "session over", and
      // must not bounce the user off the screen they are typing into.
      const isOurs = url.startsWith(BASE_URL);
      const sentToken =
        /Bearer /.test(String(init?.headers?.Authorization ?? '')) ||
        /Bearer /.test(String((init?.headers as any)?.get?.('Authorization') ?? ''));

      if (res.status === 401 && isOurs && sentToken && !handling) {
        handling = true;
        onExpired?.();
        // Let the burst of parallel 401s settle before arming again.
        setTimeout(() => { handling = false; }, 5000);
      }
    } catch {
      // Never let this bookkeeping break a real response.
    }

    return res;
  };
}
