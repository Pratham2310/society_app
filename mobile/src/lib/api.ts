import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// =======================================================
// API CLIENT
//
// Same envelope as the web console: every response is
// { success, message, data, meta? }. Screens get `data` or a typed
// error, never the wrapper.
//
// The token lives in SecureStore (Keychain / Keystore), not
// AsyncStorage — AsyncStorage is plain text on a rooted device, and a
// resident token lasts 30 days.
// =======================================================

const BASE =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:5000/api/v1";

const TOKEN_KEY = "society.token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface PageMeta {
  limit: number;
  hasMore: boolean;
  page?: number;
  total?: number;
  totalPages?: number;
  nextCursor?: string | null;
  truncated?: boolean;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

// SecureStore is async, so the token is cached in memory after the
// first read — every request would otherwise hit the keychain.
let cachedToken: string | null | undefined;

export const tokenStore = {

  async get() {
    if (cachedToken !== undefined) return cachedToken;
    try {
      cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      cachedToken = null;
    }
    return cachedToken;
  },

  async set(token: string) {
    cachedToken = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async clear() {
    cachedToken = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  },

};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

type Query = Record<string, string | number | boolean | undefined | null>;

interface Options {
  method?: string;
  body?: unknown;
  query?: Query;
  /** Skip the token and the 401 redirect — used before sign-in. */
  anonymous?: boolean;
  /** Sent as Idempotency-Key. Gate scans and payments retry on bad networks. */
  idempotencyKey?: string;
}

const buildUrl = (path: string, query?: Query) => {

  if (!query) return BASE + path;

  const parts: string[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.length ? `${BASE}${path}?${parts.join("&")}` : BASE + path;

};

// A request id per call. The backend honours and logs it, so a crash
// report and one exact server log line can be lined up.
const requestId = () =>
  `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function request<T>(
  path: string,
  { method = "GET", body, query, anonymous, idempotencyKey }: Options = {}
): Promise<{ data: T; meta?: PageMeta }> {

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": requestId(),
  };

  if (!anonymous) {
    const token = await tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // On a phone this is the common case, not the exception.
    throw new ApiError("No connection. Check your network and try again.", 0);
  }

  let payload: {
    success?: boolean; message?: string; data?: T; meta?: PageMeta;
  } = {};

  try {
    payload = await response.json();
  } catch {
    throw new ApiError("The server sent something unexpected.", response.status);
  }

  if (!response.ok || payload.success === false) {

    // 401 means the session is gone. 403 means the account is real but
    // not permitted — often "awaiting approval", which must not look
    // like being signed out.
    if (response.status === 401 && !anonymous) {
      await tokenStore.clear();
      onUnauthorized?.();
    }

    throw new ApiError(payload.message ?? "Something went wrong", response.status);

  }

  return { data: payload.data as T, meta: payload.meta };

}

export const api = {

  get: <T>(path: string, query?: Query) =>
    request<T>(path, { query }).then((r) => r.data),

  /** Cursor-paginated list. Pass mode:"cursor" to open a sequence. */
  getPage: <T>(path: string, query?: Query): Promise<Page<T>> =>
    request<T[]>(path, { query }).then((r) => ({
      items: r.data ?? [],
      meta: r.meta ?? { limit: 20, hasMore: false },
    })),

  post: <T>(path: string, body?: unknown, opts?: Pick<Options, "anonymous" | "idempotencyKey">) =>
    request<T>(path, { method: "POST", body, ...opts }).then((r) => r.data),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }).then((r) => r.data),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }).then((r) => r.data),

  // DELETE carries a body for device de-registration, where the thing
  // being removed is named by a token rather than a URL id.
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body }).then((r) => r.data),

};

/** For a request the client may safely retry — one key per attempt set. */
export const newIdempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
