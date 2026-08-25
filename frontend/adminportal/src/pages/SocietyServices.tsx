import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { Loading, ErrorBanner, Empty } from "../components/ui";

// =======================================================
// SERVICES ON A SOCIETY
//
// The catalogue is shared across the platform; which entries a society
// shows its residents is per-society, along with whether one is
// recommended, an emergency number, or carries a local note.
//
// Detaching leaves the service in the catalogue — other societies may
// still be using it.
// =======================================================

interface CatalogueService {
  _id: string;
  name: string;
  category?: string;
  phone?: string;
  isActive?: boolean;
}

interface AttachedService extends CatalogueService {
  address?: string;
  is24Hours?: boolean;
  isRecommended: boolean;
  isEmergency: boolean;
  isVisible: boolean;
  notes: string;
}

const asArray = <T,>(raw: unknown, keys: string[]): T[] => {
  if (Array.isArray(raw)) return raw as T[];
  const obj = raw as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(obj?.[key])) return obj[key] as T[];
  }
  return [];
};

export function SocietyServices({ societyId }: { societyId: string }) {

  const queryClient = useQueryClient();

  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const attached = useQuery({
    queryKey: ["society-services", societyId],
    queryFn: async () =>
      asArray<AttachedService>(
        await api.get<unknown>(`/societies/${societyId}/services`),
        ["services", "items"]
      ),
  });

  const catalogue = useQuery({
    queryKey: ["services"],
    queryFn: async () =>
      asArray<CatalogueService>(await api.get<unknown>("/services"), ["services", "items"]),
    enabled: picking,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["society-services", societyId] });

  const add = useMutation({
    mutationFn: () =>
      api.post(`/societies/${societyId}/services`, { serviceIds: selected }),
    onSuccess: () => {
      setSelected([]);
      setPicking(false);
      refresh();
    },
  });

  const flag = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch(`/societies/${societyId}/services/${id}`, patch),
    onSuccess: () => {
      setNoteFor(null);
      refresh();
    },
  });

  const detach = useMutation({
    mutationFn: (id: string) => api.del(`/societies/${societyId}/services/${id}`),
    onSuccess: refresh,
  });

  const list = attached.data ?? [];
  const attachedIds = new Set(list.map((s) => s._id));

  // Only offer what is not already here — re-adding is a no-op anyway,
  // but showing it as available is misleading.
  const available = (catalogue.data ?? []).filter((s) => !attachedIds.has(s._id));

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  return (
    <section
      className="stack"
      style={{ gap: ".9rem", maxWidth: "44rem", borderTop: "1px solid var(--line)", paddingTop: "1.25rem" }}
    >

      <div className="row" style={{ justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: "1.02rem", fontWeight: 600 }}>Services</h3>
          <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: ".2rem" }}>
            What residents see on this society's map. Drawn from the shared
            catalogue — detaching here does not delete the service.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setPicking((v) => !v)}>
          {picking ? "Cancel" : "Add services"}
        </button>
      </div>

      <ErrorBanner error={attached.error ?? add.error ?? flag.error ?? detach.error} />

      {picking && (
        <div
          className="stack"
          style={{
            gap: ".6rem", padding: "1rem", background: "var(--surface-2)",
            border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
          }}
        >
          {catalogue.isLoading ? (
            <Loading label="Loading catalogue" />
          ) : available.length === 0 ? (
            <Empty>
              Every service in the catalogue is already attached. Add new ones
              from the Services page first.
            </Empty>
          ) : (
            <>
              {available.map((s) => (
                <label
                  key={s._id}
                  className="row"
                  style={{ gap: ".6rem", cursor: "pointer", fontSize: ".93rem" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s._id)}
                    onChange={() => toggle(s._id)}
                  />
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span className="pill pill-muted">{s.category ?? "others"}</span>
                  <span className="mono tnum" style={{ color: "var(--muted)" }}>{s.phone}</span>
                </label>
              ))}
              <button
                className="btn btn-primary btn-sm"
                style={{ alignSelf: "flex-start", marginTop: ".3rem" }}
                disabled={selected.length === 0 || add.isPending}
                onClick={() => add.mutate()}
              >
                {add.isPending
                  ? <><span className="spinner" /> Adding</>
                  : `Add ${selected.length || ""} ${selected.length === 1 ? "service" : "services"}`.trim()}
              </button>
            </>
          )}
        </div>
      )}

      {attached.isLoading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty>
          No services attached. Residents will see an empty map until you add
          at least the emergency numbers.
        </Empty>
      ) : (
        <div className="stack" style={{ gap: ".5rem" }}>
          {list.map((s) => (
            <div
              key={s._id}
              className="stack"
              style={{
                gap: ".5rem", padding: ".8rem .95rem",
                border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
              }}
            >

              <div className="row" style={{ gap: ".6rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span className="pill pill-muted">{s.category ?? "others"}</span>
                {s.isEmergency && <span className="pill pill-danger">emergency</span>}
                {s.isRecommended && <span className="pill pill-ok">recommended</span>}
                {!s.isVisible && <span className="pill pill-warn">hidden</span>}
                <span className="grow" />
                <span className="mono tnum" style={{ color: "var(--muted)", fontSize: ".88rem" }}>
                  {s.phone}
                </span>
              </div>

              {noteFor === s._id ? (
                <div className="row" style={{ gap: ".4rem" }}>
                  <input
                    className="input" value={noteDraft} autoFocus
                    placeholder="A note residents will see — gate access, who to ask for…"
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={flag.isPending}
                    onClick={() => flag.mutate({ id: s._id, patch: { notes: noteDraft } })}
                  >
                    Save
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setNoteFor(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                s.notes && (
                  <p style={{ fontSize: ".88rem", color: "var(--ink-soft)" }}>{s.notes}</p>
                )
              )}

              <div className="row" style={{ gap: ".35rem", flexWrap: "wrap" }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={flag.isPending}
                  onClick={() => flag.mutate({
                    id: s._id, patch: { isRecommended: !s.isRecommended },
                  })}
                >
                  {s.isRecommended ? "Unrecommend" : "Recommend"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={flag.isPending}
                  onClick={() => flag.mutate({
                    id: s._id, patch: { isEmergency: !s.isEmergency },
                  })}
                >
                  {s.isEmergency ? "Not emergency" : "Mark emergency"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={flag.isPending}
                  onClick={() => flag.mutate({
                    id: s._id, patch: { isVisible: !s.isVisible },
                  })}
                >
                  {s.isVisible ? "Hide" : "Show"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setNoteFor(s._id); setNoteDraft(s.notes ?? ""); }}
                >
                  {s.notes ? "Edit note" : "Add note"}
                </button>
                <span className="grow" />
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={detach.isPending}
                  onClick={() => detach.mutate(s._id)}
                >
                  Remove
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </section>
  );

}
