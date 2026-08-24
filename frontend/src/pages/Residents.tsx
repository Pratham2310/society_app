import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Empty, StatusPill, formatDate } from "../components/ui";

// =======================================================
// RESIDENTS
//
// Two jobs on one screen, because they are the same job at different
// stages: clear the approval queue, and fix whoever ended up in the
// wrong flat afterwards.
//
// A flat is claimed the moment someone registers for it. Declining
// hands it back; once approved, moving them does. Either way the real
// occupant must eventually be able to register.
// =======================================================

interface Resident {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  flatNumber?: string;
  wingId?: string;
  societyRole?: string;
  occupancyType?: string;
  livingType?: string;
  familySize?: number;
  status?: string;
  vehicles?: Array<{ type: string; number: string; parkingSlot?: string }>;
  createdAt?: string;
}

interface Wing {
  _id: string;
  name: string;
  floors: Array<{
    floor: number;
    flats: Array<{ _id: string; flatNumber: string; isOccupied: boolean }>;
    availableCount: number;
  }>;
}

const asArray = <T,>(raw: unknown, keys: string[]): T[] => {
  if (Array.isArray(raw)) return raw as T[];
  const obj = raw as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(obj?.[key])) return obj[key] as T[];
  }
  return [];
};

export function Residents() {

  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [moving, setMoving] = useState<string | null>(null);
  const [target, setTarget] = useState({ wingId: "", flatNumber: "" });
  const [removing, setRemoving] = useState<string | null>(null);

  const pending = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () =>
      asArray<Resident>(
        await api.get<unknown>("/users/pending-users"),
        ["users", "items", "pendingUsers"]
      ),
  });

  const everyone = useQuery({
    queryKey: ["all-users"],
    queryFn: async () =>
      asArray<Resident>(await api.get<unknown>("/users/all-users/"), ["users", "items"]),
  });

  // The public structure endpoint already returns every flat with its
  // occupancy, which is exactly what a move needs.
  const structure = useQuery({
    queryKey: ["society-structure", user?.societyId],
    enabled: Boolean(moving && user?.societyId),
    queryFn: async () => {
      const data = await api.get<{ wings: Wing[] }>(
        `/societies/${user!.societyId}/structure`
      );
      return data.wings ?? [];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pending-users"] });
    queryClient.invalidateQueries({ queryKey: ["all-users"] });
    queryClient.invalidateQueries({ queryKey: ["society-structure"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const decide = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "approved" | "rejected" }) =>
      api.put(`/users/update-status/${userId}`, { status }),
    onSuccess: refresh,
  });

  const move = useMutation({
    mutationFn: (userId: string) =>
      api.put(`/users/reassign-flat/${userId}`, target),
    onSuccess: () => {
      setMoving(null);
      setTarget({ wingId: "", flatNumber: "" });
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.del(`/users/resident/${userId}`),
    onSuccess: () => {
      setRemoving(null);
      refresh();
    },
  });

  const queue = pending.data ?? [];
  const roster = (everyone.data ?? []).filter((r) => r.status !== "pending");

  const wings = structure.data ?? [];
  const chosenWing = wings.find((w) => w._id === target.wingId);
  const freeFlats = chosenWing
    ? chosenWing.floors.flatMap((f) => f.flats).filter((f) => !f.isOccupied)
    : [];

  return (
    <>
      <PageHeader
        title="Residents"
        subtitle="Nobody can sign in to the app until you approve them. Declining hands their flat back."
      />

      <ErrorBanner
        error={pending.error ?? everyone.error ?? decide.error ?? move.error ?? remove.error}
      />

      {/* ---------- approval queue ---------- */}

      <section className="card" style={{ marginBottom: "1.5rem" }}>

        <div className="card-head">
          <h2>Waiting for approval</h2>
          <span className={`pill ${queue.length ? "pill-warn" : "pill-muted"} tnum`}>
            {queue.length}
          </span>
        </div>

        {pending.isLoading ? (
          <Loading />
        ) : queue.length === 0 ? (
          <Empty>
            Nobody is waiting. New registrations appear here as residents
            join with the society code.
          </Empty>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Flat</th>
                  <th>Household</th>
                  <th>Vehicles</th>
                  <th>Registered</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: ".85rem", color: "var(--muted)" }}>
                        {r.phone ?? r.email ?? "—"}
                      </div>
                    </td>
                    <td className="tnum" style={{ fontWeight: 600 }}>{r.flatNumber ?? "—"}</td>
                    <td style={{ fontSize: ".9rem" }}>
                      {[
                        r.occupancyType,
                        r.livingType,
                        r.familySize ? `${r.familySize} people` : null,
                      ].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="mono" style={{ fontSize: ".88rem" }}>
                      {r.vehicles?.length ? r.vehicles.map((v) => v.number).join(", ") : "—"}
                    </td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      <div className="row" style={{ gap: ".4rem", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ userId: r._id, status: "approved" })}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          title={r.flatNumber
                            ? `Declines them and frees flat ${r.flatNumber}`
                            : "Decline this registration"}
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ userId: r._id, status: "rejected" })}
                        >
                          Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </section>

      {/* ---------- roster ---------- */}

      <section className="card">

        <div className="card-head">
          <h2>Everyone else</h2>
          <span style={{ fontSize: ".88rem", color: "var(--muted)" }} className="tnum">
            {roster.length}
          </span>
        </div>

        {everyone.isLoading ? (
          <Loading />
        ) : roster.length === 0 ? (
          <Empty>No approved residents yet.</Empty>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Flat</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => {

                  const isMoving = moving === r._id;
                  const isRemoving = removing === r._id;

                  return (
                    <tr key={r._id}>

                      <td>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div style={{ fontSize: ".85rem", color: "var(--muted)" }}>
                          {r.phone ?? r.email ?? "—"}
                        </div>
                      </td>

                      <td className="tnum" style={{ fontWeight: 600 }}>
                        {r.flatNumber ?? <span style={{ color: "var(--muted)" }}>none</span>}
                      </td>

                      <td style={{ textTransform: "capitalize" }}>
                        {r.societyRole?.replace(/_/g, " ") ?? "—"}
                      </td>

                      <td><StatusPill status={r.status} /></td>

                      <td>
                        <div className="row" style={{ gap: ".35rem", justifyContent: "flex-end" }}>

                          {isMoving && (
                            <>
                              <select
                                className="select" style={{ width: "7rem" }}
                                value={target.wingId}
                                onChange={(e) => setTarget({ wingId: e.target.value, flatNumber: "" })}
                              >
                                <option value="">Wing…</option>
                                {wings.map((w) => (
                                  <option key={w._id} value={w._id}>{w.name}</option>
                                ))}
                              </select>
                              <select
                                className="select" style={{ width: "7rem" }}
                                value={target.flatNumber}
                                disabled={!target.wingId}
                                onChange={(e) => setTarget({ ...target, flatNumber: e.target.value })}
                              >
                                <option value="">Flat…</option>
                                {freeFlats.map((f) => (
                                  <option key={f._id} value={f.flatNumber}>{f.flatNumber}</option>
                                ))}
                              </select>
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={!target.flatNumber || move.isPending}
                                onClick={() => move.mutate(r._id)}
                              >
                                Move
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setMoving(null)}>
                                Cancel
                              </button>
                            </>
                          )}

                          {isRemoving && (
                            <>
                              <span style={{ fontSize: ".84rem", color: "var(--danger)" }}>
                                Remove and free {r.flatNumber ?? "their flat"}?
                              </span>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={remove.isPending}
                                onClick={() => remove.mutate(r._id)}
                              >
                                Yes, remove
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setRemoving(null)}>
                                Keep
                              </button>
                            </>
                          )}

                          {!isMoving && !isRemoving && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="Frees their current flat and claims the new one"
                                onClick={() => {
                                  setMoving(r._id);
                                  setRemoving(null);
                                  setTarget({ wingId: "", flatNumber: "" });
                                }}
                              >
                                Change flat
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                title={r.societyRole === "secretary"
                                  ? "Assign the secretary role to someone else first"
                                  : "They moved out — frees their flat"}
                                disabled={r.societyRole === "secretary"}
                                onClick={() => { setRemoving(r._id); setMoving(null); }}
                              >
                                Remove
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
