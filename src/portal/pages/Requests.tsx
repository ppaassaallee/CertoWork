import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../lib/firebase";
import { usePortal, usePortalCollection } from "../PortalContext";
import type { ItemView } from "../../lib/clientPortal/types";

export function PortalRequestsPage() {
  const { t, clientId } = usePortal();
  const items = usePortalCollection<ItemView>("items");
  const requests = items.filter((i) => i.kind === "request");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const create = async () => {
    if (!clientId || !title.trim() || !projectId.trim()) return;
    setBusy(true);
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "createPortalRequest");
      await fn({ clientId, projectId, title, description });
      setNotice("Request created");
      setOpen(false);
      setTitle("");
      setDescription("");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cp-grid">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>{t("requests")}</h1>
        <button className="cp-btn" onClick={() => setOpen(true)} type="button">
          {t("newRequest")}
        </button>
      </div>
      <div className="cp-card">
        {requests.map((r) => (
          <div className="cp-row" key={r.id}>
            <div>
              <strong>{r.requestNumber ? `${r.requestNumber} · ` : ""}{r.title}</strong>
              <div className="cp-muted">{r.lastPublicUpdate || "—"}</div>
            </div>
            <span className="cp-pill">{r.status}</span>
          </div>
        ))}
        {requests.length === 0 ? <p className="cp-muted">No requests yet.</p> : null}
      </div>
      {notice ? <p className="cp-muted">{notice}</p> : null}
      {open ? (
        <div className="cp-card">
          <h2 style={{ marginTop: 0, fontSize: 16 }}>{t("newRequest")}</h2>
          <input
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Project id"
            style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid var(--c-line)" }}
            value={projectId}
          />
          <input
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid var(--c-line)" }}
            value={title}
          />
          <textarea
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={4}
            style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid var(--c-line)" }}
            value={description}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="cp-btn" disabled={busy} onClick={create} type="button">
              Create
            </button>
            <button className="cp-btn ghost" onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
