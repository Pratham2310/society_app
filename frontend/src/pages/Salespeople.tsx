import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Empty, StatusPill, formatDate } from "../components/ui";

// =======================================================
// SALESPEOPLE
//
// Superadmin only. Each row carries the number that actually matters
// about a salesperson — how many societies they have onboarded.
// =======================================================

interface Salesperson {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  status?: string;
  societiesOnboarded?: number;
  createdAt?: string;
}

const BLANK = { name: "", email: "", phone: "", password: "" };

export function Salespeople() {

  const queryClient = useQueryClient();

  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  const list = useQuery({
    queryKey: ["salespeople"],
    queryFn: async () => {
      const raw = await api.get<unknown>("/admin/salespeople");
      if (Array.isArray(raw)) return raw as Salesperson[];
      const obj = raw as Record<string, unknown>;
      for (const key of ["salespeople", "users", "items"]) {
        if (Array.isArray(obj?.[key])) return obj[key] as Salesperson[];
      }
      return [] as Salesperson[];
    },
  });

  const create = useMutation({
    mutationFn: () => api.post<Salesperson>("/admin/create-salesperson", form),
    onSuccess: () => {
      setComposing(false);
      setForm({ ...BLANK });
      queryClient.invalidateQueries({ queryKey: ["salespeople"] });
      queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
    },
  });

  const people = list.data ?? [];

  const valid =
    form.name.trim() &&
    /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(form.email) &&
    /^[0-9]{10}$/.test(form.phone) &&
    form.password.length >= 8;

  const totalSocieties = people.reduce((n, p) => n + (p.societiesOnboarded ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Salespeople"
        subtitle="They onboard societies and see the ones they created — never each other's."
        actions={
          <button className="btn btn-primary" onClick={() => setComposing((v) => !v)}>
            {composing ? "Cancel" : "Add salesperson"}
          </button>
        }
      />

      <ErrorBanner error={list.error ?? create.error} />

      {composing && (
        <div
          className="card card-pad stack"
          style={{ gap: "1rem", marginBottom: "1.25rem", maxWidth: "34rem" }}
        >

          <div style={{ display: "grid", gap: ".9rem", gridTemplateColumns: "1fr 1fr" }}>
            <div className="field">
              <label>Full name</label>
              <input
                className="input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                className="input tnum" value={form.phone} inputMode="numeric" maxLength={10}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                placeholder="10 digits"
              />
            </div>
          </div>

          <div className="field">
            <label>Email</label>
            <input
              className="input" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@company.com"
            />
            <span style={{ fontSize: ".8rem", color: "var(--muted)" }}>
              Must use a real top-level domain — .local and .test addresses are rejected.
            </span>
          </div>

          <div className="field">
            <label>Temporary password</label>
            <input
              className="input" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            disabled={!valid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <><span className="spinner" /> Creating</> : "Create salesperson"}
          </button>

        </div>
      )}

      <section className="card">

        <div className="card-head">
          <h2>Team</h2>
          <span style={{ fontSize: ".88rem", color: "var(--muted)" }} className="tnum">
            {people.length} {people.length === 1 ? "person" : "people"}
            {totalSocieties > 0 && ` · ${totalSocieties} societies onboarded`}
          </span>
        </div>

        {list.isLoading ? (
          <Loading />
        ) : people.length === 0 ? (
          <Empty>
            No salespeople yet. They are the ones who onboard societies,
            so this is usually the first thing to set up.
          </Empty>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Societies</th>
                  <th>Status</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p._id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ color: "var(--muted)" }}>{p.email}</td>
                    <td className="mono tnum">{p.phone ?? "—"}</td>
                    <td>
                      <span
                        className={`pill ${p.societiesOnboarded ? "pill-ok" : "pill-muted"}`}
                      >
                        {p.societiesOnboarded ?? 0}
                      </span>
                    </td>
                    <td><StatusPill status={p.status} /></td>
                    <td>{formatDate(p.createdAt)}</td>
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
