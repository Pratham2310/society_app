import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Stat, Empty, formatDate } from "../components/ui";

// =======================================================
// SOCIETY OVERVIEW
//
// The committee's landing page. The dashboard endpoint returns extra
// financial blocks for chairman, secretary and treasurer, and omits
// them for an ordinary member — so everything below is optional.
// =======================================================

interface Dashboard {
  user: { name: string; flat?: string; wing?: string };
  urgentNotice?: { _id: string; title: string; description: string; createdAt?: string } | null;
  announcements?: Array<{ _id: string; title: string; category?: string; createdAt?: string }>;
  upcomingEvent?: { _id: string; title: string; eventDate?: string; location?: string } | null;
  maintenanceStats?: { totalCollected: number; totalPending: number };
  expenseStats?: { totalExpense: number };
  fundStats?: { totalFunds: number };
  pendingComplaints?: number;
}

const money = (n?: number) =>
  n === undefined ? "—" : `₹${n.toLocaleString("en-IN")}`;

export function SocietyOverview() {

  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<Dashboard>("/residents/dashboard"),
  });

  const isAdmin = data?.maintenanceStats !== undefined;

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.name?.split(" ")[0] ?? "there"}`}
        subtitle="What needs attention in your society today."
        actions={<Link className="btn btn-primary" to="/residents">Resident approvals</Link>}
      />

      <ErrorBanner error={error} />

      {isLoading ? (
        <Loading />
      ) : (
        <div className="stack" style={{ gap: "1.5rem" }}>

          {isAdmin && (
            <div
              style={{
                display: "grid", gap: "1rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
              }}
            >
              <Stat label="Collected" value={money(data?.maintenanceStats?.totalCollected)} tone="ok" />
              <Stat label="Dues outstanding" value={money(data?.maintenanceStats?.totalPending)} tone="warn" />
              <Stat label="Expenses" value={money(data?.expenseStats?.totalExpense)} />
              <Stat label="Community funds" value={money(data?.fundStats?.totalFunds)} />
              <Stat label="Open complaints" value={data?.pendingComplaints ?? 0} tone="warn" />
            </div>
          )}

          {data?.urgentNotice && (
            <div
              className="card card-pad stack"
              style={{ gap: ".35rem", borderLeft: "3px solid var(--danger)" }}
            >
              <span className="pill pill-danger" style={{ alignSelf: "flex-start" }}>Urgent notice</span>
              <strong style={{ fontSize: "1.02rem" }}>{data.urgentNotice.title}</strong>
              <p style={{ color: "var(--ink-soft)", fontSize: ".93rem" }}>
                {data.urgentNotice.description}
              </p>
              <span style={{ fontSize: ".84rem", color: "var(--muted)" }}>
                {formatDate(data.urgentNotice.createdAt)}
              </span>
            </div>
          )}

          <div style={{ display: "grid", gap: "1.25rem", gridTemplateColumns: "repeat(auto-fit, minmax(19rem, 1fr))" }}>

            <section className="card">
              <div className="card-head">
                <h2>Announcements</h2>
                <Link to="/notices" style={{ fontSize: ".9rem" }}>Manage</Link>
              </div>
              {data?.announcements?.length ? (
                <div className="stack">
                  {data.announcements.map((a) => (
                    <div
                      key={a._id}
                      style={{ padding: ".85rem 1.25rem", borderBottom: "1px solid var(--line)" }}
                    >
                      <div className="row" style={{ gap: ".5rem", marginBottom: ".15rem" }}>
                        <span className="pill pill-muted">{a.category ?? "general"}</span>
                        <span style={{ fontSize: ".82rem", color: "var(--muted)" }}>
                          {formatDate(a.createdAt)}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: ".95rem" }}>{a.title}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>Nothing announced recently.</Empty>
              )}
            </section>

            <section className="card">
              <div className="card-head"><h2>Next event</h2></div>
              {data?.upcomingEvent ? (
                <div className="card-pad stack" style={{ gap: ".3rem" }}>
                  <strong style={{ fontSize: "1rem" }}>{data.upcomingEvent.title}</strong>
                  <span style={{ color: "var(--muted)", fontSize: ".92rem" }}>
                    {formatDate(data.upcomingEvent.eventDate)}
                    {data.upcomingEvent.location ? ` · ${data.upcomingEvent.location}` : ""}
                  </span>
                </div>
              ) : (
                <Empty>No events scheduled.</Empty>
              )}
            </section>

          </div>

        </div>
      )}
    </>
  );

}
