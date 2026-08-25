// =======================================================
// API CLIENT
//
// Every backend response is { success, message, data, meta? }.
// Screens should never see that shape — they get `data`, or an
// ApiError they can render. One place to change if the envelope
// ever does.
// =======================================================

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";

const TOKEN_KEY = "society.console.token";

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

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Called when the server rejects our token, so the app can send the
// user back to sign-in from one place instead of every screen.
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Opt out of the redirect-to-login on 401 — used by the login call. */
  anonymous?: boolean;
}

const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const url = new URL(BASE + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
};

async function request<T>(
  path: string,
  { method = "GET", body, query, anonymous }: RequestOptions = {}
): Promise<{ data: T; meta?: PageMeta }> {

  const token = tokenStore.get();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // The backend honours and logs this, so a bug report maps to one
    // exact server log line.
    "X-Request-Id": crypto.randomUUID(),
  };

  if (token && !anonymous) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // A blocked CORS request and a dead server look identical here.
    throw new ApiError(
      "Could not reach the server. Check it is running and that this origin is allowed.",
      0
    );
  }

  let payload: { success?: boolean; message?: string; data?: T; meta?: PageMeta } = {};

  try {
    payload = await response.json();
  } catch {
    throw new ApiError(`Unexpected response from the server (${response.status})`, response.status);
  }

  if (!response.ok || payload.success === false) {

    // 401 means the token is gone or expired. 403 means the account is
    // real but not permitted — signing the user out for that would be
    // wrong and confusing.
    if (response.status === 401 && !anonymous) {
      tokenStore.clear();
      onUnauthorized?.();
    }

    throw new ApiError(payload.message ?? "Request failed", response.status);

  }

  return { data: payload.data as T, meta: payload.meta };

}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    request<T>(path, { query }).then((r) => r.data),

  /** For list endpoints, where meta carries the paging state. */
  getPage: <T>(path: string, query?: RequestOptions["query"]): Promise<Paged<T>> =>
    request<T[]>(path, { query }).then((r) => ({
      items: r.data ?? [],
      meta: r.meta ?? { limit: 20, hasMore: false },
    })),

  post: <T>(path: string, body?: unknown, opts?: { anonymous?: boolean }) =>
    request<T>(path, { method: "POST", body, anonymous: opts?.anonymous }).then((r) => r.data),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }).then((r) => r.data),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }).then((r) => r.data),

  del: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }).then((r) => r.data),
};
