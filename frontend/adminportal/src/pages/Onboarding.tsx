import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { PageHeader } from "../components/Layout";
import { ErrorBanner } from "../components/ui";

// =======================================================
// ONBOARD A SOCIETY
//
// Four steps then finalize. The backend keeps a draft between steps
// and only writes the society, secretary, wings and flats when
// finalize runs — inside one transaction. So leaving halfway costs
// nothing, and the draft is picked up by draftId.
//
// Step 2 matters more than it looks: floors x flats-per-floor is what
// generates every flat document, and residents pick from those when
// they register. Getting it wrong means a resident cannot find their
// flat.
// =======================================================

interface Draft { _id: string; step: number; data: Record<string, unknown>; }

interface WingInput { name: string; totalFloors: number; flatsPerFloor: number; }

const STEPS = ["Society", "Structure", "Secretary", "Confirm"] as const;

export function Onboarding() {

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [society, setSociety] = useState({
    societyName: "", address: "", city: "", state: "", pincode: "",
  });

  const [wings, setWings] = useState<WingInput[]>([
    { name: "A", totalFloors: 4, flatsPerFloor: 4 },
  ]);

  const [secretary, setSecretary] = useState({
    name: "", email: "", phone: "", password: "",
  });

  const [result, setResult] = useState<{
    society: { name: string; societyCode: string; _id: string };
    secretary?: { email: string };
  } | null>(null);

  const totalFlats = wings.reduce((n, w) => n + w.totalFloors * w.flatsPerFloor, 0);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const submitStep1 = () => run(async () => {
    const draft = await api.post<Draft>("/onboarding/step1", society);
    setDraftId(draft._id);
    setStep(1);
  });

  const submitStep2 = () => run(async () => {
    // The backend reads wingData.name here; sending wingName silently
    // produced wings with no name and failed the whole finalize.
    await api.post<Draft>("/onboarding/step2", { draftId, structure: wings });
    setStep(2);
  });

  const submitStep3 = () => run(async () => {
    await api.post<Draft>("/onboarding/step3", { draftId, secretary });
    await api.post<Draft>("/onboarding/step4", { draftId, services: [] });
    setStep(3);
  });

  const finalize = () => run(async () => {
    const done = await api.post<typeof result>("/onboarding/finalize", { draftId });
    setResult(done);
    queryClient.invalidateQueries({ queryKey: ["societies"] });
    queryClient.invalidateQueries({ queryKey: ["sales-dashboard"] });
  });

  // ---- done ----------------------------------------------------

  if (result) {
    return (
      <>
        <PageHeader title="Society onboarded" />
        <div className="card card-pad stack" style={{ gap: "1.15rem", maxWidth: "34rem" }}>

          <div className="banner banner-ok">
            {result.society.name} is live.
          </div>

          <div className="stack" style={{ gap: ".3rem" }}>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: ".68rem",
                letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)",
              }}
            >
              Join code
            </span>
            <span
              className="mono tnum"
              style={{ fontSize: "2.4rem", fontWeight: 600, letterSpacing: ".12em" }}
            >
              {result.society.societyCode}
            </span>
            <p style={{ color: "var(--muted)", fontSize: ".92rem" }}>
              Give this to the secretary. Residents type it into the app to find
              the society and register. It is six digits so it survives being
              read out over the phone.
            </p>
          </div>

          {result.secretary && (
            <p style={{ fontSize: ".92rem" }}>
              The secretary account <strong>{result.secretary.email}</strong> can
              sign in to this console now and approve residents as they register.
            </p>
          )}

          <div className="row" style={{ gap: ".5rem" }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/societies/${result.society._id}`)}
            >
              Open society
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setResult(null); setDraftId(null); setStep(0); }}
            >
              Onboard another
            </button>
          </div>

        </div>
      </>
    );
  }

  // ---- wizard --------------------------------------------------

  return (
    <>
      <PageHeader
        title="Onboard a society"
        subtitle="Four steps. Nothing is written until the last one, so you can stop and come back."
      />

      <div className="row" style={{ gap: ".4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`pill ${i === step ? "pill-info" : i < step ? "pill-ok" : "pill-muted"}`}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      <div className="card card-pad stack" style={{ gap: "1.1rem", maxWidth: "40rem" }}>

        <ErrorBanner error={error} />

        {step === 0 && (
          <>
            <div className="field">
              <label>Society name</label>
              <input
                className="input" value={society.societyName}
                onChange={(e) => setSociety({ ...society, societyName: e.target.value })}
                placeholder="Emerald Heights"
              />
            </div>
            <div className="field">
              <label>Address</label>
              <input
                className="input" value={society.address}
                onChange={(e) => setSociety({ ...society, address: e.target.value })}
              />
            </div>
            <div style={{ display: "grid", gap: ".9rem", gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div className="field">
                <label>City</label>
                <input
                  className="input" value={society.city}
                  onChange={(e) => setSociety({ ...society, city: e.target.value })}
                />
              </div>
              <div className="field">
                <label>State</label>
                <input
                  className="input" value={society.state}
                  onChange={(e) => setSociety({ ...society, state: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Pincode</label>
                <input
                  className="input tnum" value={society.pincode} inputMode="numeric"
                  onChange={(e) => setSociety({ ...society, pincode: e.target.value })}
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ alignSelf: "flex-start" }}
              disabled={busy || !society.societyName.trim()}
              onClick={submitStep1}
            >
              Continue
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
              Every flat is generated from this. A wing with 4 floors and 4 flats
              per floor produces 101–104, 201–204 and so on — which is what
              residents choose from when they register.
            </p>

            {wings.map((wing, i) => (
              <div
                key={i}
                className="stack"
                style={{
                  gap: ".75rem", padding: "1rem", border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)", background: "var(--surface-2)",
                }}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong style={{ fontSize: ".95rem" }}>Wing {wing.name || i + 1}</strong>
                  {wings.length > 1 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setWings(wings.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ display: "grid", gap: ".75rem", gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <div className="field">
                    <label>Name</label>
                    <input
                      className="input" value={wing.name}
                      onChange={(e) => setWings(wings.map((w, j) =>
                        j === i ? { ...w, name: e.target.value } : w))}
                      placeholder="A"
                    />
                  </div>
                  <div className="field">
                    <label>Floors</label>
                    <input
                      className="input tnum" type="number" min={1} value={wing.totalFloors}
                      onChange={(e) => setWings(wings.map((w, j) =>
                        j === i ? { ...w, totalFloors: Number(e.target.value) } : w))}
                    />
                  </div>
                  <div className="field">
                    <label>Flats per floor</label>
                    <input
                      className="input tnum" type="number" min={1} value={wing.flatsPerFloor}
                      onChange={(e) => setWings(wings.map((w, j) =>
                        j === i ? { ...w, flatsPerFloor: Number(e.target.value) } : w))}
                    />
                  </div>
                </div>
                <span style={{ fontSize: ".85rem", color: "var(--muted)" }}>
                  {wing.totalFloors * wing.flatsPerFloor} flats
                </span>
              </div>
            ))}

            <button
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: "flex-start" }}
              onClick={() => setWings([...wings, { name: "", totalFloors: 4, flatsPerFloor: 4 }])}
            >
              Add another wing
            </button>

            <div className="row" style={{ gap: ".5rem", justifyContent: "space-between" }}>
              <span style={{ fontSize: ".9rem", color: "var(--muted)" }}>
                <strong className="tnum" style={{ color: "var(--ink)" }}>{totalFlats}</strong> flats in total
              </span>
              <div className="row" style={{ gap: ".5rem" }}>
                <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
                <button
                  className="btn btn-primary"
                  disabled={busy || wings.some((w) => !w.name.trim() || w.totalFloors < 1 || w.flatsPerFloor < 1)}
                  onClick={submitStep2}
                >
                  Continue
                </button>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
              The secretary runs the society day to day and approves residents as
              they register. This creates their account.
            </p>
            <div className="field">
              <label>Full name</label>
              <input
                className="input" value={secretary.name}
                onChange={(e) => setSecretary({ ...secretary, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                className="input" type="email" value={secretary.email}
                onChange={(e) => setSecretary({ ...secretary, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                className="input tnum" value={secretary.phone} inputMode="numeric"
                onChange={(e) => setSecretary({ ...secretary, phone: e.target.value })}
                placeholder="10 digits"
              />
            </div>
            <div className="field">
              <label>Temporary password</label>
              <input
                className="input" type="text" value={secretary.password}
                onChange={(e) => setSecretary({ ...secretary, password: e.target.value })}
                placeholder="They sign in with this"
              />
            </div>
            <div className="row" style={{ gap: ".5rem" }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button
                className="btn btn-primary"
                disabled={busy || !secretary.name || !secretary.email || !secretary.phone || !secretary.password}
                onClick={submitStep3}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 style={{ fontSize: "1.05rem" }}>Confirm</h3>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: ".5rem 1.25rem", margin: 0 }}>
              <dt style={{ color: "var(--muted)" }}>Society</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{society.societyName}</dd>
              <dt style={{ color: "var(--muted)" }}>Location</dt>
              <dd style={{ margin: 0 }}>{[society.city, society.state].filter(Boolean).join(", ") || "—"}</dd>
              <dt style={{ color: "var(--muted)" }}>Wings</dt>
              <dd style={{ margin: 0 }}>
                {wings.map((w) => `${w.name} (${w.totalFloors}x${w.flatsPerFloor})`).join(", ")}
              </dd>
              <dt style={{ color: "var(--muted)" }}>Flats</dt>
              <dd style={{ margin: 0 }} className="tnum">{totalFlats}</dd>
              <dt style={{ color: "var(--muted)" }}>Secretary</dt>
              <dd style={{ margin: 0 }}>{secretary.name} · {secretary.email}</dd>
            </dl>
            <p style={{ fontSize: ".9rem", color: "var(--muted)" }}>
              Finalising writes the society, the secretary account, and all {totalFlats}{" "}
              flats in one transaction, then issues the six-digit join code.
            </p>
            <div className="row" style={{ gap: ".5rem" }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
              <button className="btn btn-primary" disabled={busy} onClick={finalize}>
                {busy ? <><span className="spinner" /> Creating</> : "Create society"}
              </button>
            </div>
          </>
        )}

      </div>
    </>
  );

}
