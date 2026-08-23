import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Empty, formatDate } from "../components/ui";

// =======================================================
// RESIDENT APPROVALS
//
// The screen the whole mobile app waits on. A resident who registers
// lands as `pending`, and both the login check and the approval
// middleware refuse a pending account — so until someone approves
// them here, they cannot get past sign-in on their phone.
// =======================================================

interface PendingUser {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  flatNumber?: string;
  occupancyType?: string;
  livingType?: string;
  familySize?: number;
  vehicles?: Array<{ type: string; number: string; parkingSlot?: string }>;
  createdAt?: string;
}

export function Residents() {

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      // This endpoint answers { users: [...] } rather than a bare
      // array, so taking the response as a list silently rendered an
      // empty table while people were actually waiting. Normalise
      // instead of trusting one shape.
      const raw = await api.get<unknown>("/users/pending-users");
      if (Array.isArray(raw)) return raw as PendingUser[];
      const obj = raw as Record<string, unknown>;
      for (const key of ["users", "items", "pendingUsers"]) {
        if (Array.isArray(obj?.[key])) return obj[key] as PendingUser[];
      }
      return [] as PendingUser[];
    },
  });

  const decide = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "approved" | "rejected" }) =>
      api.put(`/users/update-status/${userId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-users"] }),
  });

  const pending = data ?? [];

  return (
    <>
      <PageHeader
        title="Resident approvals"
        subtitle="Nobody can use the app until you approve them here. Check the flat matches the person."
      />

      <ErrorBanner error={error ?? decide.error} />

      <section className="card">

        <div className="card-head">
          <h2>Waiting for approval</h2>
          <span className="pill pill-warn tnum">{pending.length}</span>
        </div>

        {isLoading ? (
          <Loading />
        ) : pending.length === 0 ? (
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
                {pending.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: ".85rem", color: "var(--muted)" }}>
                        {u.phone ?? u.email ?? "—"}
                      </div>
                    </td>
                    <td className="tnum" style={{ fontWeight: 600 }}>{u.flatNumber ?? "—"}</td>
                    <td style={{ fontSize: ".9rem" }}>
                      {[
                        u.occupancyType,
                        u.livingType,
                        u.familySize ? `${u.familySize} people` : null,
                      ].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td style={{ fontSize: ".88rem" }} className="mono">
                      {u.vehicles?.length
                        ? u.vehicles.map((v) => v.number).join(", ")
                        : "—"}
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>
                      <div className="row" style={{ gap: ".4rem", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ userId: u._id, status: "approved" })}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ userId: u._id, status: "rejected" })}
                        >
                          Reject
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
    </>
  );

}
