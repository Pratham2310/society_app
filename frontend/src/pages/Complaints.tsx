import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Empty, StatusPill, formatDate } from "../components/ui";

// =======================================================
// COMPLAINTS
//
// The committee's queue. Residents raise these from the app, and
// unresolved ones show a badge on their home screen.
// =======================================================

interface Complaint {
  _id: string;
  title: string;
  category?: string;
  status?: string;
  isUrgent?: boolean;
  image?: string;
  flatNumber?: string;
  createdAt?: string;
}

const FILTERS = ["", "pending", "in_progress", "resolved"] as const;

export function Complaints() {

  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["complaints", status, page],
    queryFn: () => api.getPage<Complaint>("/complaints", { status, page, limit: 20 }),
  });

  const complaints = data?.items ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title="Complaints"
        subtitle="Raised by residents from the app. Urgent ones are flagged."
      />

      <ErrorBanner error={error} />

      <section className="card">

        <div className="card-head" style={{ gap: ".4rem" }}>
          {FILTERS.map((f) => (
            <button
              key={f || "all"}
              className={`btn btn-sm ${status === f ? "btn-primary" : "btn-ghost"}`}
              onClick={() => { setStatus(f); setPage(1); }}
            >
              {f ? f.replace("_", " ") : "All"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <Loading />
        ) : complaints.length === 0 ? (
          <Empty>
            {status ? `No ${status.replace("_", " ")} complaints.` : "No complaints raised yet."}
          </Empty>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Flat</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Raised</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <div className="row" style={{ gap: ".5rem" }}>
                        {c.isUrgent && <span className="pill pill-danger">Urgent</span>}
                        <span style={{ fontWeight: 600 }}>{c.title}</span>
                      </div>
                    </td>
                    <td className="tnum">{c.flatNumber ?? "—"}</td>
                    <td><span className="pill pill-muted">{c.category ?? "general"}</span></td>
                    <td><StatusPill status={c.status} /></td>
                    <td>{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && (meta.totalPages ?? 1) > 1 && (
          <div
            className="row"
            style={{ gap: ".6rem", padding: "1rem 1.25rem", borderTop: "1px solid var(--line)" }}
          >
            <button
              className="btn btn-ghost btn-sm"
              disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="tnum" style={{ fontSize: ".88rem", color: "var(--muted)" }}>
              Page {page} of {meta.totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={!meta.hasMore} onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}

      </section>
    </>
  );

}
