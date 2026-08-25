import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Empty, StatusPill, formatDate } from "../components/ui";
import { SocietyManage } from "./SocietyManage";

interface Society {
  _id: string;
  name: string;
  city?: string;
  state?: string;
  societyCode?: string;
  status?: string;
  createdAt?: string;
}

interface SocietyListResponse {
  societies: Society[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// =======================================================
// LIST
// =======================================================

export function Societies() {

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["societies", page, search],
    queryFn: () =>
      api.get<SocietyListResponse>("/sales/societies", { page, limit: 20, search }),
  });

  const societies = data?.societies ?? [];
  const pages = data?.pagination?.totalPages ?? 1;

  return (
    <>
      <PageHeader
        title="Societies"
        subtitle="Every society you have onboarded, with the code residents use to join."
        actions={<Link className="btn btn-primary" to="/onboarding">Onboard a society</Link>}
      />

      <ErrorBanner error={error} />

      <section className="card">

        <div className="card-head">
          <input
            className="input"
            style={{ maxWidth: "18rem" }}
            placeholder="Search by name or city"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <span style={{ fontSize: ".88rem", color: "var(--muted)" }}>
            {data?.pagination?.total ?? 0} total
          </span>
        </div>

        {isLoading ? (
          <Loading />
        ) : societies.length === 0 ? (
          <Empty>
            {search
              ? `No societies match “${search}”.`
              : "No societies yet. Onboarding one takes four steps and issues a join code."}
          </Empty>
        ) : (
          <div className="tablewrap" style={{ opacity: isFetching ? .6 : 1 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Society</th>
                  <th>Location</th>
                  <th>Join code</th>
                  <th>Status</th>
                  <th>Onboarded</th>
                </tr>
              </thead>
              <tbody>
                {societies.map((s) => (
                  <tr key={s._id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link to={`/societies/${s._id}`}>{s.name}</Link>
                    </td>
                    <td>{[s.city, s.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="mono tnum">{s.societyCode ?? "—"}</td>
                    <td><StatusPill status={s.status} /></td>
                    <td>{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div
            className="row"
            style={{ gap: ".6rem", padding: "1rem 1.25rem", borderTop: "1px solid var(--line)" }}
          >
            <button
              className="btn btn-ghost btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="tnum" style={{ fontSize: ".88rem", color: "var(--muted)" }}>
              Page {page} of {pages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}

      </section>
    </>
  );

}

// =======================================================
// DETAIL
// =======================================================

interface Person {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  societyRole?: string;
  flatNumber?: string;
  status?: string;
}

type Tab = "residents" | "leadership" | "security" | "staff" | "manage";

const TABS: { key: Tab; label: string; path: (id: string) => string }[] = [
  { key: "residents", label: "Residents", path: (id) => `/sales/society/${id}/residents` },
  { key: "leadership", label: "Committee", path: (id) => `/sales/society/${id}/leadership` },
  { key: "security", label: "Security", path: (id) => `/sales/society/${id}/security` },
  { key: "staff", label: "Staff", path: (id) => `/sales/society/${id}/staff/all` },
];

export function SocietyDetail() {

  const { societyId = "" } = useParams();
  const [tab, setTab] = useState<Tab>("residents");

  const society = useQuery({
    queryKey: ["society", societyId],
    queryFn: () => api.get<Society>(`/sales/society/${societyId}`),
  });

  const active = TABS.find((t) => t.key === tab);

  const people = useQuery({
    //Manage is not a people list, so it must not drive this query.
    enabled: Boolean(active),
    queryKey: ["society-people", societyId, tab],
    queryFn: async () => {
      // These endpoints have never been exercised, and their shapes
      // differ: some return an array, some wrap it. Normalise here so
      // the table does not have to guess.
      const raw = await api.get<unknown>(active!.path(societyId), { page: 1, limit: 50 });
      if (Array.isArray(raw)) return raw as Person[];
      const obj = raw as Record<string, unknown>;
      for (const key of ["residents", "members", "staff", "leadership", "security", "data", "items"]) {
        if (Array.isArray(obj?.[key])) return obj[key] as Person[];
      }
      return [] as Person[];
    },
  });

  return (
    <>
      <PageHeader
        title={society.data?.name ?? "Society"}
        subtitle={
          society.data
            ? `${[society.data.city, society.data.state].filter(Boolean).join(", ")} · join code ${society.data.societyCode ?? "—"}`
            : undefined
        }
        actions={<Link className="btn btn-ghost" to="/societies">Back to societies</Link>}
      />

      <ErrorBanner error={society.error ?? people.error} />

      <section className="card">

        <div className="card-head" style={{ gap: ".4rem" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
          <span className="grow" />
          <button
            className={`btn btn-sm ${tab === "manage" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("manage")}
          >
            Manage
          </button>
        </div>

        {tab === "manage" ? (
          society.data
            ? <SocietyManage society={society.data} />
            : <Loading label="Loading society" />
        ) : people.isLoading ? (
          <Loading />
        ) : (people.data?.length ?? 0) === 0 ? (
          <Empty>No {active?.label.toLowerCase()} recorded for this society.</Empty>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Flat</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {people.data!.map((p) => (
                  <tr key={p._id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="tnum">{p.flatNumber ?? "—"}</td>
                    <td>{p.societyRole?.replace("_", " ") ?? "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{p.phone ?? p.email ?? "—"}</td>
                    <td><StatusPill status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </section>
    </>
  );

}
