import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Empty, formatDate } from "../components/ui";

// =======================================================
// SALESPEOPLE
//
// Superadmin only. Each row carries the number that actually matters
// about a salesperson — how many societies they have onboarded — and
// that number also decides whether deleting them is allowed.
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

// An index signature, because this is sent straight through as a
// partial patch body alongside fields like status.
interface Draft {
  [key: string]: string;
  name: string;
  email: string;
  phone: string;
}

const BLANK = { name: "", email: "", phone: "", password: "" };

export function Salespeople() {

  const queryClient = useQueryClient();

  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  // Edited in place rather than in a modal: the table is the context.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", email: "", phone: "" });

  // A second click before anything is destroyed.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["salespeople"] });
    queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
  };

  const create = useMutation({
    mutationFn: () => api.post<Salesperson>("/admin/create-salesperson", form),
    onSuccess: () => {
      setComposing(false);
      setForm({ ...BLANK });
      refresh();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch(`/admin/salespeople/${id}`, patch),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/admin/salespeople/${id}`),
    onSuccess: () => {
      setConfirmingDelete(null);
      refresh();
    },
  });

  const people = list.data ?? [];

  const validNew =
    form.name.trim() &&
    /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(form.email) &&
    /^[0-9]{10}$/.test(form.phone) &&
    form.password.length >= 8;

  const totalSocieties = people.reduce((n, p) => n + (p.societiesOnboarded ?? 0), 0);

  const digitsOnly = (value: string) => value.replace(/[^0-9]/g, "");

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

      <ErrorBanner error={list.error ?? create.error ?? update.error ?? remove.error} />

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
                onChange={(e) => setForm({ ...form, phone: digitsOnly(e.target.value) })}
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
            disabled={!validNew || create.isPending}
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {people.map((person) => {

                  const isEditing = editing === person._id;
                  const isConfirming = confirmingDelete === person._id;
                  const owns = person.societiesOnboarded ?? 0;
                  const suspended = person.status === "rejected";

                  return (
                    <tr key={person._id}>

                      <td style={{ fontWeight: 600 }}>
                        {isEditing ? (
                          <input
                            className="input" style={{ minWidth: "9rem" }} value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          />
                        ) : person.name}
                      </td>

                      <td style={{ color: "var(--muted)" }}>
                        {isEditing ? (
                          <input
                            className="input" style={{ minWidth: "13rem" }} value={draft.email}
                            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                          />
                        ) : person.email}
                      </td>

                      <td className="mono tnum">
                        {isEditing ? (
                          <input
                            className="input tnum" style={{ minWidth: "8rem" }}
                            value={draft.phone} maxLength={10}
                            onChange={(e) => setDraft({ ...draft, phone: digitsOnly(e.target.value) })}
                          />
                        ) : (person.phone ?? "—")}
                      </td>

                      <td>
                        <span className={`pill ${owns ? "pill-ok" : "pill-muted"}`}>{owns}</span>
                      </td>

                      <td>
                        <span className={`pill ${suspended ? "pill-danger" : "pill-ok"}`}>
                          {suspended ? "suspended" : "active"}
                        </span>
                      </td>

                      <td>{formatDate(person.createdAt)}</td>

                      <td>
                        <div className="row" style={{ gap: ".35rem", justifyContent: "flex-end" }}>

                          {isEditing && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={update.isPending}
                                onClick={() => update.mutate({ id: person._id, patch: draft })}
                              >
                                Save
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                                Cancel
                              </button>
                            </>
                          )}

                          {isConfirming && (
                            <>
                              <span style={{ fontSize: ".84rem", color: "var(--danger)" }}>
                                Delete permanently?
                              </span>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={remove.isPending}
                                onClick={() => remove.mutate(person._id)}
                              >
                                Yes, delete
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setConfirmingDelete(null)}
                              >
                                Keep
                              </button>
                            </>
                          )}

                          {!isEditing && !isConfirming && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setEditing(person._id);
                                  setConfirmingDelete(null);
                                  setDraft({
                                    name: person.name,
                                    email: person.email,
                                    phone: person.phone ?? "",
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={update.isPending}
                                onClick={() => update.mutate({
                                  id: person._id,
                                  patch: { status: suspended ? "approved" : "rejected" },
                                })}
                              >
                                {suspended ? "Reactivate" : "Suspend"}
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                // Deleting someone who onboarded societies would
                                // orphan them. The backend refuses too; this just
                                // says so before the click.
                                title={owns
                                  ? `Onboarded ${owns} ${owns === 1 ? "society" : "societies"} — suspend instead`
                                  : "Delete this account"}
                                disabled={owns > 0}
                                onClick={() => {
                                  setConfirmingDelete(person._id);
                                  setEditing(null);
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}

                        </div>
                      </td>

                    </tr>
                  );

                })}
              </tbody>
            </table>
          </div>
        )}

      </section>
    </>
  );

}
