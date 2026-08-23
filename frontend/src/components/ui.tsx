import type { ReactNode } from "react";

import { ApiError } from "../lib/api";

// =======================================================
// SMALL SHARED PIECES
// Loading, empty and error states appear on every screen, so they
// are worth having one honest version of.
// =======================================================

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="row" style={{ gap: ".6rem", padding: "2rem 1.25rem", color: "var(--muted)" }}>
      <span className="spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function ErrorBanner({ error }: { error: unknown }) {

  if (!error) return null;

  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Something went wrong";

  // A 403 is not a failure of the app, so say what it actually means.
  const hint =
    error instanceof ApiError && error.status === 403
      ? "Your role does not allow this."
      : error instanceof ApiError && error.status === 0
        ? "The server may be offline, or this origin may not be in its CORS allowlist."
        : null;

  return (
    <div className="banner banner-error stack" style={{ gap: ".25rem" }}>
      <span>{message}</span>
      {hint && <span style={{ opacity: .85, fontSize: ".86rem" }}>{hint}</span>}
    </div>
  );

}

export function Stat({
  label, value, tone = "default",
}: { label: string; value: ReactNode; tone?: "default" | "ok" | "warn" }) {
  const color =
    tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--ink)";
  return (
    <div className="card card-pad stack" style={{ gap: ".3rem" }}>
      <span
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: ".67rem",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </span>
      <span
        className="tnum"
        style={{ fontFamily: "Archivo, sans-serif", fontSize: "1.75rem", fontWeight: 700, color }}
      >
        {value}
      </span>
    </div>
  );
}

export function StatusPill({ status }: { status?: string }) {
  const map: Record<string, string> = {
    approved: "pill-ok",
    active: "pill-ok",
    paid: "pill-ok",
    pending: "pill-warn",
    rejected: "pill-danger",
    resolved: "pill-ok",
  };
  return <span className={`pill ${map[status ?? ""] ?? "pill-muted"}`}>{status ?? "—"}</span>;
}

export const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
