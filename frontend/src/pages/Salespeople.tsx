import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { ErrorBanner } from "../components/ui";

// =======================================================
// SALESPEOPLE
//
// Superadmin only. There is no list endpoint for salespeople yet, so
// this creates them and confirms the result rather than pretending to
// show a roster it cannot fetch.
// =======================================================

interface Created { _id: string; name: string; email: string; systemRole: string; }

export function Salespeople() {

  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [created, setCreated] = useState<Created | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post<Created>("/admin/create-salesperson", form),
    onSuccess: (data) => {
      setCreated(data);
      setForm({ name: "", email: "", phone: "", password: "" });
      queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
    },
  });

  const valid = form.name && form.email && /^[0-9]{10}$/.test(form.phone) && form.password.length >= 8;

  return (
    <>
      <PageHeader
        title="Salespeople"
        subtitle="Salespeople onboard societies and see the ones they created."
      />

      <div style={{ display: "grid", gap: "1.25rem", gridTemplateColumns: "minmax(0, 28rem) 1fr" }}>

        <div className="card card-pad stack" style={{ gap: "1rem" }}>

          <h2 style={{ fontSize: "1.02rem", fontWeight: 600 }}>Add a salesperson</h2>

          <ErrorBanner error={mutation.error} />

          {created && (
            <div className="banner banner-ok">
              {created.name} can now sign in with {created.email}.
            </div>
          )}

          <div className="field">
            <label>Full name</label>
            <input
              className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              className="input" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <><span className="spinner" /> Creating</> : "Create salesperson"}
          </button>

        </div>

        <div className="card card-pad stack" style={{ gap: ".7rem", alignSelf: "flex-start" }}>
          <h2 style={{ fontSize: "1.02rem", fontWeight: 600 }}>What they can do</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--ink-soft)", fontSize: ".93rem" }}>
            <li>Onboard a society and create its secretary</li>
            <li>See the societies they onboarded, and the residents in them</li>
            <li>Manage the service catalogue</li>
          </ul>
          <p style={{ fontSize: ".9rem", color: "var(--muted)" }}>
            They cannot see another salesperson's societies. Only a superadmin
            reads across the whole platform.
          </p>
        </div>

      </div>
    </>
  );

}
