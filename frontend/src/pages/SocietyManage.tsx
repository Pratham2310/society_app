import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { useAuth, isSuperadmin } from "../lib/auth";
import { ErrorBanner, Loading, Empty } from "../components/ui";

// =======================================================
// SOCIETY MANAGEMENT
//
// The three things a platform admin actually needs after onboarding:
// correct the details, change who runs it, and — rarely — remove it.
//
// Rendered as a tab inside the society detail page, because all three
// belong to one society and splitting them across screens would mean
// re-establishing which society you meant each time.
// =======================================================

interface Society {
  _id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string | number;
  status?: string;
  societyCode?: string;
}

interface Member {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  societyRole?: string;
  flatNumber?: string;
  status?: string;
}

const STATUSES = ["under_construction", "active", "handed_over"] as const;

export function SocietyManage({ society }: { society: Society }) {

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [details, setDetails] = useState({
    name: "", address: "", city: "", state: "", pincode: "",
    status: "active" as (typeof STATUSES)[number],
  });

  // Seed the form once the society arrives, and again if it changes.
  useEffect(() => {
    setDetails({
      name: society.name ?? "",
      address: society.address ?? "",
      city: society.city ?? "",
      state: society.state ?? "",
      pincode: String(society.pincode ?? ""),
      status: (society.status as (typeof STATUSES)[number]) ?? "active",
    });
  }, [society]);

  const [mode, setMode] = useState<"promote" | "create">("promote");
  const [promoteId, setPromoteId] = useState("");
  const [newSecretary, setNewSecretary] = useState({
    name: "", email: "", phone: "", password: "",
  });

  const [confirmName, setConfirmName] = useState("");
  const [dangerOpen, setDangerOpen] = useState(false);

  const members = useQuery({
    queryKey: ["society-members", society._id],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/societies/${society._id}/members`);
      return Array.isArray(raw) ? (raw as Member[]) : [];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["society", society._id] });
    queryClient.invalidateQueries({ queryKey: ["society-members", society._id] });
    queryClient.invalidateQueries({ queryKey: ["societies"] });
  };

  const saveDetails = useMutation({
    mutationFn: () => api.patch(`/societies/${society._id}`, details),
    onSuccess: refresh,
  });

  const assign = useMutation({
    mutationFn: () =>
      api.post<{ secretary: Member; steppedDown: Member | null }>(
        `/societies/${society._id}/secretary`,
        mode === "promote" ? { userId: promoteId } : newSecretary
      ),
    onSuccess: () => {
      setPromoteId("");
      setNewSecretary({ name: "", email: "", phone: "", password: "" });
      refresh();
    },
  });

  const destroy = useMutation({
    mutationFn: () => api.del(`/societies/${society._id}`),
    onSuccess: () => navigate("/societies", { replace: true }),
  });

  const people = members.data ?? [];
  const secretary = people.find((m) => m.societyRole === "secretary");
  const residents = people.filter((m) => m.societyRole !== "secretary");

  const digitsOnly = (v: string) => v.replace(/[^0-9]/g, "");

  const canAssign =
    mode === "promote"
      ? Boolean(promoteId)
      : Boolean(
          newSecretary.name &&
          /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(newSecretary.email) &&
          /^[0-9]{10}$/.test(newSecretary.phone) &&
          newSecretary.password.length >= 8
        );

  return (
    <div className="stack" style={{ gap: "1.25rem", padding: "1.25rem" }}>

      <ErrorBanner error={saveDetails.error ?? assign.error ?? destroy.error ?? members.error} />

      {/* ---------- details ---------- */}

      <section className="stack" style={{ gap: ".9rem", maxWidth: "40rem" }}>

        <h3 style={{ fontSize: "1.02rem", fontWeight: 600 }}>Details</h3>

        <div className="field">
          <label>Society name</label>
          <input
            className="input" value={details.name}
            onChange={(e) => setDetails({ ...details, name: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Address</label>
          <input
            className="input" value={details.address}
            onChange={(e) => setDetails({ ...details, address: e.target.value })}
          />
        </div>

        <div style={{ display: "grid", gap: ".9rem", gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="field">
            <label>City</label>
            <input
              className="input" value={details.city}
              onChange={(e) => setDetails({ ...details, city: e.target.value })}
            />
          </div>
          <div className="field">
            <label>State</label>
            <input
              className="input" value={details.state}
              onChange={(e) => setDetails({ ...details, state: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Pincode</label>
            <input
              className="input tnum" value={details.pincode} inputMode="numeric"
              onChange={(e) => setDetails({ ...details, pincode: digitsOnly(e.target.value) })}
            />
          </div>
        </div>

        <div className="field" style={{ maxWidth: "16rem" }}>
          <label>Status</label>
          <select
            className="select" value={details.status}
            onChange={(e) => setDetails({ ...details, status: e.target.value as typeof details.status })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div className="row" style={{ gap: ".7rem" }}>
          <button
            className="btn btn-primary"
            disabled={saveDetails.isPending || !details.name.trim()}
            onClick={() => saveDetails.mutate()}
          >
            {saveDetails.isPending ? <><span className="spinner" /> Saving</> : "Save details"}
          </button>
          {saveDetails.isSuccess && !saveDetails.isPending && (
            <span style={{ color: "var(--ok)", fontSize: ".9rem" }}>Saved</span>
          )}
        </div>

        <p style={{ fontSize: ".86rem", color: "var(--muted)" }}>
          The join code <strong className="mono tnum">{society.societyCode}</strong> cannot be
          changed. Residents have it written down, and changing it would break
          every registration in progress.
        </p>

      </section>

      {/* ---------- secretary ---------- */}

      <section
        className="stack"
        style={{ gap: ".9rem", maxWidth: "40rem", borderTop: "1px solid var(--line)", paddingTop: "1.25rem" }}
      >

        <div>
          <h3 style={{ fontSize: "1.02rem", fontWeight: 600 }}>Secretary</h3>
          <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: ".2rem" }}>
            {secretary
              ? <>Currently <strong style={{ color: "var(--ink)" }}>{secretary.name}</strong> ({secretary.email}). Assigning someone else steps them down to member.</>
              : "This society has no secretary, so nobody can approve residents joining it."}
          </p>
        </div>

        <div className="row" style={{ gap: ".4rem" }}>
          <button
            className={`btn btn-sm ${mode === "promote" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("promote")}
          >
            Promote a resident
          </button>
          <button
            className={`btn btn-sm ${mode === "create" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("create")}
          >
            Create a new account
          </button>
        </div>

        {mode === "promote" ? (
          members.isLoading ? (
            <Loading label="Loading residents" />
          ) : residents.length === 0 ? (
            <Empty>
              Nobody lives here yet. Create the account instead — someone has to
              be able to approve the first residents.
            </Empty>
          ) : (
            <div className="field">
              <label>Resident</label>
              <select
                className="select" value={promoteId}
                onChange={(e) => setPromoteId(e.target.value)}
              >
                <option value="">Choose someone…</option>
                {residents.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                    {m.flatNumber ? ` · ${m.flatNumber}` : ""}
                    {m.societyRole ? ` · ${m.societyRole.replace(/_/g, " ")}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )
        ) : (
          <>
            <div style={{ display: "grid", gap: ".9rem", gridTemplateColumns: "1fr 1fr" }}>
              <div className="field">
                <label>Full name</label>
                <input
                  className="input" value={newSecretary.name}
                  onChange={(e) => setNewSecretary({ ...newSecretary, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  className="input tnum" value={newSecretary.phone} maxLength={10} inputMode="numeric"
                  onChange={(e) => setNewSecretary({ ...newSecretary, phone: digitsOnly(e.target.value) })}
                />
              </div>
            </div>
            <div className="field">
              <label>Email</label>
              <input
                className="input" type="email" value={newSecretary.email}
                onChange={(e) => setNewSecretary({ ...newSecretary, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Temporary password</label>
              <input
                className="input" value={newSecretary.password}
                onChange={(e) => setNewSecretary({ ...newSecretary, password: e.target.value })}
                placeholder="At least 8 characters"
              />
            </div>
          </>
        )}

        <div className="row" style={{ gap: ".7rem" }}>
          <button
            className="btn btn-primary"
            disabled={!canAssign || assign.isPending}
            onClick={() => assign.mutate()}
          >
            {assign.isPending ? <><span className="spinner" /> Assigning</> : "Assign secretary"}
          </button>
          {assign.isSuccess && !assign.isPending && (
            <span style={{ color: "var(--ok)", fontSize: ".9rem" }}>
              Assigned
              {assign.data?.steppedDown && ` · ${assign.data.steppedDown.name} stepped down`}
            </span>
          )}
        </div>

      </section>

      {/* ---------- danger ---------- */}

      {isSuperadmin(user) && (
        <section
          className="stack"
          style={{ gap: ".8rem", maxWidth: "40rem", borderTop: "1px solid var(--line)", paddingTop: "1.25rem" }}
        >

          <h3 style={{ fontSize: "1.02rem", fontWeight: 600, color: "var(--danger)" }}>
            Delete this society
          </h3>

          <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
            Removes the society, its wings, its flats and every account in it.
            Refused while residents still live here — set the status to
            <em> handed over</em> instead if it is simply no longer active.
            {residents.length > 0 && (
              <strong style={{ color: "var(--ink)" }}>
                {" "}{residents.length} {residents.length === 1 ? "person lives" : "people live"} here now.
              </strong>
            )}
          </p>

          {!dangerOpen ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: "flex-start", color: "var(--danger)" }}
              onClick={() => setDangerOpen(true)}
            >
              I want to delete this society
            </button>
          ) : (
            <>
              <div className="field">
                <label>Type <strong>{society.name}</strong> to confirm</label>
                <input
                  className="input" value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={society.name}
                />
              </div>
              <div className="row" style={{ gap: ".5rem" }}>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={confirmName.trim() !== society.name || destroy.isPending}
                  onClick={() => destroy.mutate()}
                >
                  {destroy.isPending ? <><span className="spinner" /> Deleting</> : "Delete permanently"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setDangerOpen(false); setConfirmName(""); }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

        </section>
      )}

    </div>
  );

}
