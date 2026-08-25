import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Empty } from "../components/ui";

// =======================================================
// SERVICES
//
// The shared catalogue — clinics, shops, plumbers, emergency numbers —
// that societies get assigned and residents see on their map. Defined
// once here rather than per society, so a change to a phone number
// reaches everyone.
// =======================================================

interface Service {
  _id: string;
  name: string;
  category?: string;
  description?: string;
  phone?: string;
  address?: string;
  openTime?: string;
  closeTime?: string;
  is24Hours?: boolean;
  isActive?: boolean;
}

const CATEGORIES = [
  "health", "education", "shopping", "maintenance", "emergency", "others",
] as const;

const BLANK = {
  name: "", category: "others" as (typeof CATEGORIES)[number],
  description: "", phone: "", address: "", is24Hours: false,
};

export function Services() {

  const queryClient = useQueryClient();

  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [filter, setFilter] = useState<string>("");

  const list = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const raw = await api.get<unknown>("/services");
      // Shape unverified until now: accept a bare array or a wrapper.
      if (Array.isArray(raw)) return raw as Service[];
      const obj = raw as Record<string, unknown>;
      for (const key of ["services", "items", "data"]) {
        if (Array.isArray(obj?.[key])) return obj[key] as Service[];
      }
      return [] as Service[];
    },
  });

  const create = useMutation({
    mutationFn: () => api.post<Service>("/services", form),
    onSuccess: () => {
      setComposing(false);
      setForm({ ...BLANK });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const toggle = useMutation({
    mutationFn: (s: Service) => api.put(`/services/${s._id}`, { isActive: !s.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const services = (list.data ?? []).filter(
    (s) => !filter || s.category === filter
  );

  const valid = form.name.trim() && /^[0-9+\-\s]{6,15}$/.test(form.phone);

  return (
    <>
      <PageHeader
        title="Services"
        subtitle="The catalogue societies draw from. Residents see assigned services on their map."
        actions={
          <button className="btn btn-primary" onClick={() => setComposing((v) => !v)}>
            {composing ? "Cancel" : "Add service"}
          </button>
        }
      />

      <ErrorBanner error={list.error ?? create.error ?? toggle.error} />

      {composing && (
        <div className="card card-pad stack" style={{ gap: "1rem", marginBottom: "1.25rem", maxWidth: "40rem" }}>

          <div style={{ display: "grid", gap: ".9rem", gridTemplateColumns: "1fr 1fr" }}>
            <div className="field">
              <label>Name</label>
              <input
                className="input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Sai Medical Store"
              />
            </div>
            <div className="field">
              <label>Category</label>
              <select
                className="select" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Phone</label>
            <input
              className="input tnum" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Residents tap this to call"
            />
          </div>

          <div className="field">
            <label>Address</label>
            <input
              className="input" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ minHeight: "4.5rem" }}
            />
          </div>

          <label className="row" style={{ gap: ".5rem", fontSize: ".93rem", cursor: "pointer" }}>
            <input
              type="checkbox" checked={form.is24Hours}
              onChange={(e) => setForm({ ...form, is24Hours: e.target.checked })}
            />
            Open 24 hours
          </label>

          <button
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            disabled={!valid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <><span className="spinner" /> Saving</> : "Add service"}
          </button>

        </div>
      )}

      <section className="card">

        <div className="card-head" style={{ gap: ".4rem" }}>
          <button
            className={`btn btn-sm ${filter === "" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter("")}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`btn btn-sm ${filter === c ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {list.isLoading ? (
          <Loading />
        ) : services.length === 0 ? (
          <Empty>
            {filter
              ? `Nothing in ${filter} yet.`
              : "No services yet. Add the ones every society needs — a clinic, a plumber, the local emergency number."}
          </Empty>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Phone</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      {s.address && (
                        <div style={{ fontSize: ".85rem", color: "var(--muted)" }}>{s.address}</div>
                      )}
                    </td>
                    <td><span className="pill pill-muted">{s.category ?? "others"}</span></td>
                    <td className="mono tnum">{s.phone ?? "—"}</td>
                    <td style={{ fontSize: ".9rem" }}>
                      {s.is24Hours
                        ? "24 hours"
                        : s.openTime && s.closeTime
                          ? `${s.openTime}–${s.closeTime}`
                          : "—"}
                    </td>
                    <td>
                      <span className={`pill ${s.isActive === false ? "pill-muted" : "pill-ok"}`}>
                        {s.isActive === false ? "hidden" : "live"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate(s)}
                      >
                        {s.isActive === false ? "Show" : "Hide"}
                      </button>
                    </td>
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
