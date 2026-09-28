import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completePortalEmailLink, storedPortalEmail } from "../../lib/clientPortal/auth";

export function PortalAuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(storedPortalEmail());
  const [error, setError] = useState("");
  const [needsEmail, setNeedsEmail] = useState(!storedPortalEmail());

  useEffect(() => {
    if (needsEmail) return;
    completePortalEmailLink(email)
      .then(() => navigate("/portal", { replace: true }))
      .catch((reason) => {
        const msg = reason instanceof Error ? reason.message : "auth-failed";
        if (msg === "email-required") setNeedsEmail(true);
        else setError(msg);
      });
  }, [email, needsEmail, navigate]);

  if (needsEmail) {
    return (
      <div className="cp-login">
        <form
          className="cp-card"
          onSubmit={(e) => {
            e.preventDefault();
            setNeedsEmail(false);
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20 }}>Confirm your email</h1>
          <input
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            value={email}
          />
          <button className="cp-btn" type="submit">
            Continue
          </button>
          {error ? <p style={{ color: "var(--c-bad)" }}>{error}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="cp-login">
      <div className="cp-card">Signing you in…</div>
    </div>
  );
}
