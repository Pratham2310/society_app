import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth, isPlatform, isSuperadmin, roleLabel } from "../lib/auth";
import {
  IconDashboard, IconSocieties, IconDraft, IconServices, IconPeople,
} from "./icons";

// =======================================================
// SHELL
//
// Navigation is built from the signed-in role rather than shown and
// then 403'd.
//
// Only the platform lives here: superadmin and salespeople. A society's
// own committee works from the app, where their extra controls appear
// alongside their resident screens according to what their role
// carries.
// =======================================================

interface NavItem {
  to: string;
  label: string;
  icon: () => JSX.Element;
  show: (u: ReturnType<typeof useAuth>["user"]) => boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Platform",
    items: [
      { to: "/", label: "Dashboard", icon: IconDashboard, show: isPlatform },
      { to: "/societies", label: "Societies", icon: IconSocieties, show: isPlatform },
      { to: "/drafts", label: "Draft", icon: IconDraft, show: isPlatform },
      { to: "/services", label: "Services", icon: IconServices, show: isPlatform },
      { to: "/salespeople", label: "Salespeople", icon: IconPeople, show: isSuperadmin },
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
  if (!isPlatform(user)) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "2rem" }}>
        <div className="card card-pad stack" style={{ gap: ".75rem", maxWidth: "26rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>This console is for the platform team</h2>
          <p style={{ color: "var(--muted)", fontSize: ".95rem" }}>
            You are signed in as {roleLabel(user)}. Everyone inside a society —
            residents, security, and the committee alike — uses the app. Your
            extra controls appear there, alongside your own home screen.
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
          background: "var(--nav)",
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
        <div style={{ padding: "0 1.35rem" }}>
          <div className="brand">Society Ledger</div>
          <div className="brand-sub">
            {isPlatform(user) ? "Admin Portal" : "Committee Portal"}
          </div>
        </div>

        <nav className="stack" style={{ gap: "1.25rem", flex: 1 }}>
          {sections.map((section) => (
            <div key={section.section} className="stack" style={{ gap: ".15rem" }}>
              <div className="nav-section">{section.section}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/" || item.to === "/society"}
                  className={({ isActive }) =>
                    `nav-item${isActive ? " is-active" : ""}`}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ padding: "1rem 1.35rem 0", borderTop: "1px solid var(--line-strong)" }}>
          <div style={{ fontSize: ".9rem", fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: ".8rem", color: "var(--muted)", marginBottom: ".55rem" }}>
            {roleLabel(user)}
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
