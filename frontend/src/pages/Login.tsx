import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth, isPlatform, isCommittee } from "../lib/auth";
import { ErrorBanner } from "../components/ui";

export function Login() {

  const { user, signIn, loading } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);

  if (user) {
    return <Navigate to={isCommittee(user) && !isPlatform(user) ? "/society" : "/"} replace />;
  }

  const submit = async (event: FormEvent) => {

    event.preventDefault();
    setError(null);

    try {
      const signedIn = await signIn(identifier.trim(), password);
      navigate(isCommittee(signedIn) && !isPlatform(signedIn) ? "/society" : "/", { replace: true });
    } catch (err) {
      setError(err);
    }

  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>

      <div className="stack" style={{ gap: "1.25rem", width: "100%", maxWidth: "23rem" }}>

        <div>
          <h1 style={{ fontSize: "1.7rem", fontWeight: 700, letterSpacing: "-.02em" }}>
            Society Console
          </h1>
          <p style={{ color: "var(--muted)", marginTop: ".35rem" }}>
            For committee members, salespeople and platform admins.
          </p>
        </div>

        <form className="card card-pad stack" style={{ gap: "1rem" }} onSubmit={submit}>

          <ErrorBanner error={error} />

          <div className="field">
            <label htmlFor="identifier">Email or phone</label>
            <input
              id="identifier"
              className="input"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@society.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in</> : "Sign in"}
          </button>

        </form>

        <p style={{ fontSize: ".86rem", color: "var(--muted)" }}>
          Residents and security staff use the mobile app, not this console.
        </p>

      </div>

    </div>
  );

}
