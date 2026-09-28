import { useState } from "react";
import { sendPortalMagicLink } from "../../lib/clientPortal/auth";
import { usePortal } from "../PortalContext";

export function PortalLoginPage() {
  const { t } = usePortal();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sendPortalMagicLink(email);
      setNotice(t("linkSent"));
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "error";
      setError(msg === "revoked" ? t("revoked") : t("notInvited"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cp-login">
      <form className="cp-card" onSubmit={submit}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{t("loginTitle")}</h1>
        <p className="cp-muted">{t("loginHint")}</p>
        <label className="cp-muted" htmlFor="cp-email">
          {t("email")}
        </label>
        <input
          autoComplete="email"
          id="cp-email"
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          value={email}
        />
        <button className="cp-btn" disabled={busy} type="submit">
          {t("sendLink")}
        </button>
        {notice ? <p className="cp-muted">{notice}</p> : null}
        {error ? <p style={{ color: "var(--c-bad)", margin: 0 }}>{error}</p> : null}
      </form>
    </div>
  );
}
