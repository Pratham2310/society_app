import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { Loading, ErrorBanner, Empty, formatDate } from "../components/ui";

// =======================================================
// DRAFTS
//
// Onboarding writes nothing until finalize, so an interrupted one
// leaves a draft holding everything typed so far. Without this page a
// salesperson could not tell one existed — starting over would quietly
// overwrite it, because step1 reuses the caller's open draft.
// =======================================================

interface Draft {
  _id: string;
  step: number;
  updatedAt?: string;
  data: {
    societyName?: string;
    city?: string;
    state?: string;
    structure?: Array<{ name: string; totalFloors: number; flatsPerFloor: number }>;
    secretary?: { name?: string; email?: string };
  };
}

const STEP_LABEL = ["", "Society details", "Structure", "Secretary", "Ready to finalise"];

export function Drafts() {

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["drafts"],
    queryFn: () => api.get<Draft[]>("/onboarding/drafts"),
  });

  const discard = useMutation({
    mutationFn: (id: string) => api.del(`/onboarding/drafts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts"] }),
  });

  const drafts = data ?? [];

  return (
    <>
      <PageHeader
        title="Draft"
        subtitle="Onboardings you started but have not finalised. Nothing is created until the last step."
      />

      <ErrorBanner error={error ?? discard.error} />

      {isLoading ? (
        <Loading />
      ) : drafts.length === 0 ? (
        <div className="card">
          <Empty>
            No drafts in progress. Starting an onboarding and leaving it
            half-finished will show it here.
          </Empty>
        </div>
      ) : (
        <div className="stack" style={{ gap: "1rem" }}>
          {drafts.map((draft) => {

            const flats = (draft.data.structure ?? [])
              .reduce((n, w) => n + w.totalFloors * w.flatsPerFloor, 0);

            return (
              <div key={draft._id} className="card card-pad stack" style={{ gap: ".9rem" }}>

                <div className="row" style={{ justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ fontSize: "1.08rem", fontWeight: 600 }}>
                      {draft.data.societyName || "Untitled society"}
                    </h2>
                    <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: ".15rem" }}>
                      {[draft.data.city, draft.data.state].filter(Boolean).join(", ") || "No location yet"}
                      {" · last edited "}{formatDate(draft.updatedAt)}
                    </p>
                  </div>
                  <span className="pill pill-warn">
                    Step {draft.step} of 4 · {STEP_LABEL[draft.step] ?? ""}
                  </span>
                </div>

                <dl
                  style={{
                    display: "grid", gridTemplateColumns: "auto 1fr",
                    gap: ".35rem 1.15rem", margin: 0, fontSize: ".92rem",
                  }}
                >
                  <dt style={{ color: "var(--muted)" }}>Wings</dt>
                  <dd style={{ margin: 0 }}>
                    {draft.data.structure?.length
                      ? draft.data.structure
                          .map((w) => `${w.name} (${w.totalFloors}×${w.flatsPerFloor})`)
                          .join(", ")
                      : "Not set"}
                  </dd>
                  <dt style={{ color: "var(--muted)" }}>Flats</dt>
                  <dd style={{ margin: 0 }} className="tnum">{flats || "—"}</dd>
                  <dt style={{ color: "var(--muted)" }}>Secretary</dt>
                  <dd style={{ margin: 0 }}>
                    {draft.data.secretary?.email ?? "Not set"}
                  </dd>
                </dl>

                <div className="row" style={{ gap: ".5rem" }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate("/onboarding")}
                  >
                    Resume
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={discard.isPending}
                    onClick={() => discard.mutate(draft._id)}
                  >
                    Discard
                  </button>
                </div>

              </div>
            );

          })}
        </div>
      )}
    </>
  );

}
