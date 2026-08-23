import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Empty, formatDate } from "../components/ui";

// =======================================================
// NOTICES
//
// What residents see on their home screen. An urgent notice takes the
// card at the top of the app, so it is worth being deliberate about.
//
// This list is offset-paginated with totals, which is what the backend
// serves the web console; the app uses cursor paging on the same
// endpoint.
// =======================================================

interface Notice {
  _id: string;
  title: string;
  description: string;
  type: "notice" | "announcement";
  category?: "security" | "amenities" | "general";
  isUrgent?: boolean;
  status?: string;
  createdAt?: string;
}

const CATEGORIES = ["general", "security", "amenities"] as const;

export function Notices() {

  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({
    title: "", description: "", type: "notice" as Notice["type"],
    category: "general" as NonNullable<Notice["category"]>, isUrgent: false,
  });

  const list = useQuery({
    queryKey: ["notices", page],
    queryFn: async () => {
      const res = await api.getPage<Notice>("/notices", { page, limit: 20 });
      return res;
    },
  });

  const create = useMutation({
    mutationFn: () => api.post<Notice>("/notices", draft),
    onSuccess: () => {
      setComposing(false);
      setDraft({ title: "", description: "", type: "notice", category: "general", isUrgent: false });
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/notices/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notices"] }),
  });

  const notices = list.data?.items ?? [];
  const meta = list.data?.meta;

  return (
    <>
      <PageHeader
        title="Notices"
        subtitle="Published notices appear on every resident's home screen."
        actions={
          <button className="btn btn-primary" onClick={() => setComposing((v) => !v)}>
            {composing ? "Cancel" : "New notice"}
          </button>
        }
      />

      <ErrorBanner error={list.error ?? create.error ?? remove.error} />

      {composing && (
        <div className="card card-pad stack" style={{ gap: "1rem", marginBottom: "1.25rem", maxWidth: "40rem" }}>

          <div className="field">
            <label>Title</label>
            <input
              className="input" value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Water shutdown"
            />
          </div>

          <div className="field">
            <label>Details</label>
            <textarea
              className="textarea" value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Scheduled maintenance for overhead tanks, 10:00 AM – 2:00 PM."
            />
          </div>

          <div style={{ display: "grid", gap: ".9rem", gridTemplateColumns: "1fr 1fr" }}>
            <div className="field">
              <label>Type</label>
              <select
                className="select" value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as Notice["type"] })}
              >
                <option value="notice">Notice</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <select
                className="select" value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as typeof draft.category })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <label className="row" style={{ gap: ".5rem", fontSize: ".93rem", cursor: "pointer" }}>
            <input
              type="checkbox" checked={draft.isUrgent}
              onChange={(e) => setDraft({ ...draft, isUrgent: e.target.checked })}
            />
            Mark urgent — pins it to the top of every resident's home screen
          </label>

          <button
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            disabled={!draft.title.trim() || !draft.description.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <><span className="spinner" /> Publishing</> : "Publish"}
          </button>

        </div>
      )}

      <section className="card">

        <div className="card-head">
          <h2>Published</h2>
          {meta?.total !== undefined && (
            <span style={{ fontSize: ".88rem", color: "var(--muted)" }} className="tnum">
              {meta.total} total
            </span>
          )}
        </div>

        {list.isLoading ? (
          <Loading />
        ) : notices.length === 0 ? (
          <Empty>No notices yet.</Empty>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n._id}>
                    <td>
                      <div className="row" style={{ gap: ".5rem" }}>
                        {n.isUrgent && <span className="pill pill-danger">Urgent</span>}
                        <span style={{ fontWeight: 600 }}>{n.title}</span>
                      </div>
                      <div
                        style={{
                          fontSize: ".86rem", color: "var(--muted)", marginTop: ".15rem",
                          maxWidth: "38ch", overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {n.description}
                      </div>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{n.type}</td>
                    <td><span className="pill pill-muted">{n.category ?? "general"}</span></td>
                    <td>{formatDate(n.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(n._id)}
                      >
                        Delete
                      </button>
                    </td>
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
