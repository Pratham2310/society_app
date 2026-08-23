import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth, isPlatform, isSuperadmin, isCommittee, roleLabel } from "../lib/auth";

// =======================================================
// SHELL
//
// Navigation is built from the signed-in role rather than shown and
// then 403'd. Three audiences share this console: superadmin and
// salesperson run the platform, committee roles run one society.
// =======================================================

interface NavItem {
  to: string;
  label: string;
  show: (u: ReturnType<typeof useAuth>["user"]) => boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Platform",
    items: [
      { to: "/", label: "Overview", show: isPlatform },
      { to: "/societies", label: "Societies", show: isPlatform },
      { to: "/onboarding", label: "Onboard a society", show: isPlatform },
      { to: "/salespeople", label: "Salespeople", show: isSuperadmin },
    ],
  },
  {
    section: "Society",
    items: [
      { to: "/society", label: "Overview", show: isCommittee },
      { to: "/residents", label: "Resident approvals", show: isCommittee },
      { to: "/notices", label: "Notices", show: isCommittee },
      { to: "/complaints", label: "Complaints", show: isCommittee },
    ],
  },
];

export function Layout() {

  const { user, signOut } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // A resident or guard has no business in this console — the app is
  // theirs. Saying so beats an empty sidebar.
  if (!isPlatform(user) && !isCommittee(user)) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "2rem" }}>
        <div className="card card-pad stack" style={{ gap: ".75rem", maxWidth: "26rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>This console is for the committee</h2>
          <p style={{ color: "var(--muted)", fontSize: ".95rem" }}>
            You are signed in as {roleLabel(user)}. Residents and security staff
            use the mobile app.
          </p>
          <button className="btn btn-ghost" onClick={signOut} style={{ alignSelf: "flex-start" }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const sections = NAV
    .map((s) => ({ ...s, items: s.items.filter((i) => i.show(user)) }))
    .filter((s) => s.items.length > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "var(--sidebar) 1fr", minHeight: "100vh" }}>

      <aside
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--line)",
          padding: "1.25rem 0",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ padding: "0 1.25rem" }}>
          <div
            style={{
              fontFamily: "Archivo, sans-serif",
              fontWeight: 700,
              fontSize: "1.05rem",
              letterSpacing: "-.01em",
            }}
          >
            Society Console
          </div>
          <div className="pill pill-muted" style={{ marginTop: ".45rem" }}>
            {roleLabel(user)}
          </div>
        </div>

        <nav className="stack" style={{ gap: "1.25rem", flex: 1 }}>
          {sections.map((section) => (
            <div key={section.section} className="stack" style={{ gap: ".15rem" }}>
              <div
                style={{
                  padding: "0 1.25rem .35rem",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: ".65rem",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                {section.section}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/" || item.to === "/society"}
                  style={({ isActive }) => ({
                    padding: ".5rem 1.25rem",
                    fontSize: ".94rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--accent)" : "var(--ink-soft)",
                    background: isActive ? "var(--accent-tint)" : "transparent",
                    borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
                    textDecoration: "none",
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ padding: "0 1.25rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
          <div style={{ fontSize: ".9rem", fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: ".82rem", color: "var(--muted)", marginBottom: ".6rem" }}>
            {user.email}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main style={{ padding: "2rem 2.25rem", minWidth: 0 }}>
        <Outlet />
      </main>

    </div>
  );

}

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap",
        marginBottom: "1.5rem",
      }}
    >
      <div>
        <h1 style={{ fontSize: "1.55rem", fontWeight: 600, letterSpacing: "-.015em" }}>{title}</h1>
        {subtitle && (
          <p style={{ color: "var(--muted)", marginTop: ".3rem", maxWidth: "58ch" }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="row" style={{ gap: ".5rem" }}>{actions}</div>}
    </header>
  );
}
