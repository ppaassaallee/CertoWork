import { useMemo, useState } from "react";
import { Check, Copy, Inbox, Mail } from "./ui/Icon";
import {
  buildPersonalCaptureAlias,
  buildPersonalCaptureEmail,
  type CaptureAddress,
} from "../lib/captureRequests";

type Props = {
  userEmail?: string | null;
  userName?: string | null;
  address?: CaptureAddress | null;
  busy?: boolean;
  onEnsureAddress: () => Promise<void> | void;
  onRotateAlias?: () => Promise<void> | void;
};

function usernameFromProfile(email?: string | null, name?: string | null) {
  const fromEmail = String(email || "").split("@")[0] || "";
  const fromName = String(name || "").trim().toLowerCase().replace(/\s+/g, ".");
  return (fromEmail || fromName || "user").slice(0, 48);
}

export function CaptureIngestForm({
  onCapture,
}: {
  onCapture: (subject: string, body: string) => Promise<void> | void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="do-capture-ingest-form"
      data-testid="capture-ingest-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!subject.trim() && !body.trim()) return;
        setBusy(true);
        void Promise.resolve(onCapture(subject.trim(), body.trim())).finally(() => {
          setBusy(false);
          setSubject("");
          setBody("");
        });
      }}
    >
      <strong>Paste an email to capture</strong>
      <input
        aria-label="Email subject"
        onChange={(event) => setSubject(event.target.value)}
        placeholder="Subject"
        value={subject}
      />
      <textarea
        aria-label="Email body"
        onChange={(event) => setBody(event.target.value)}
        placeholder="Body"
        rows={3}
        value={body}
      />
      <button className="do-button do-button-dark" disabled={busy} type="submit">
        Capture into My Work
      </button>
    </form>
  );
}

export function CaptureSettingsPanel({
  userEmail,
  userName,
  address,
  busy,
  onEnsureAddress,
  onRotateAlias,
}: Props) {
  const [copied, setCopied] = useState(false);
  const preview = useMemo(
    () => address?.email || buildPersonalCaptureEmail(usernameFromProfile(userEmail, userName)),
    [address?.email, userEmail, userName],
  );
  const aliasPreview = useMemo(() => {
    if (address?.secretSuffix) {
      return buildPersonalCaptureAlias(usernameFromProfile(userEmail, userName), address.secretSuffix);
    }
    return "";
  }, [address?.secretSuffix, userEmail, userName]);

  const copy = async (value: string) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="do-capture-settings" data-testid="capture-settings">
      <header className="do-capture-settings-head">
        <Inbox size={18} />
        <div>
          <strong>Certo Capture</strong>
          <span>Forward or CC emails here to turn them into actionable work.</span>
        </div>
      </header>

      <div className="do-capture-inbox-card">
        <label>Your Certo Inbox</label>
        <div className="do-capture-inbox-row">
          <Mail size={14} />
          <code data-testid="capture-inbox-email">{preview || "—"}</code>
          <button
            className="do-button"
            data-testid="capture-inbox-copy"
            disabled={!preview}
            onClick={() => void copy(preview)}
            type="button"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {aliasPreview ? (
          <p className="do-capture-alias">
            Alias: <code>{aliasPreview}</code>
          </p>
        ) : null}
        <p className="do-capture-hint">
          Email subject becomes context. Certo AI writes the title, summary, and routes high-confidence work into My Work.
        </p>
        <div className="do-capture-actions">
          <button
            className="do-button do-button-dark"
            data-testid="capture-ensure-address"
            disabled={Boolean(busy)}
            onClick={() => void onEnsureAddress()}
            type="button"
          >
            {address ? "Refresh inbox address" : "Create inbox address"}
          </button>
          {onRotateAlias ? (
            <button
              className="do-button"
              data-testid="capture-rotate-alias"
              disabled={Boolean(busy) || !address}
              onClick={() => void onRotateAlias()}
              type="button"
            >
              Rotate alias
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
