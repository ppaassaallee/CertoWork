import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../lib/firebase";
import { usePortal, usePortalCollection } from "../PortalContext";
import type { DocumentView, InvoiceView, ProjectView } from "../../lib/clientPortal/types";

export function PortalDocumentsPage() {
  const { t, clientId } = usePortal();
  const documents = usePortalCollection<DocumentView>("documents");
  const projects = usePortalCollection<ProjectView>("projects");
  const byProject = projects.map((p) => ({
    project: p,
    docs: documents.filter((d) => d.projectId === p.id),
  }));

  const download = async (documentId: string) => {
    const fn = httpsCallable(getFunctions(app, "us-central1"), "getPortalDocumentUrl");
    const res = await fn({ clientId, documentId });
    const url = (res.data as any)?.url;
    if (url) window.open(String(url), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="cp-grid">
      <h1 style={{ margin: 0 }}>{t("documents")}</h1>
      {byProject.map(({ project, docs }) =>
        docs.length ? (
          <section className="cp-card" key={project.id}>
            <h2 style={{ marginTop: 0, fontSize: 15 }}>{project.name}</h2>
            {docs.map((d) => (
              <div className="cp-row" key={d.id}>
                <div>
                  <strong>{d.name}</strong>
                  <div className="cp-muted">
                    {d.mime || "file"} · {d.size ? `${Math.round(d.size / 1024)} KB` : ""} · {d.publishedAt?.slice(0, 10) || ""}
                    {d.signed ? " · Signed" : ""}
                  </div>
                </div>
                <button className="cp-btn secondary" onClick={() => download(d.id)} type="button">
                  {t("download")}
                </button>
              </div>
            ))}
          </section>
        ) : null,
      )}
      {documents.length === 0 ? <div className="cp-card cp-muted">No documents yet.</div> : null}
    </div>
  );
}

export function PortalInvoicesPage() {
  const { t } = usePortal();
  const invoices = usePortalCollection<InvoiceView>("invoices");
  const projects = usePortalCollection<ProjectView>("projects");
  const nameFor = (id?: string) => projects.find((p) => p.id === id)?.name || id || "—";

  return (
    <div className="cp-grid">
      <h1 style={{ margin: 0 }}>{t("invoices")}</h1>
      <div className="cp-card">
        {invoices.map((inv) => (
          <div className="cp-row" key={inv.id}>
            <div>
              <div className="cp-mono">{inv.number}</div>
              <div className="cp-muted">
                {nameFor(inv.projectId)} · {inv.issueDate || "—"} → {inv.dueDate || "—"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <strong>
                {inv.amount} {inv.currency}
              </strong>
              <div>
                <span className="cp-pill">{inv.status}</span>
              </div>
              {inv.paymentLink ? (
                <a className="cp-muted" href={inv.paymentLink} rel="noreferrer" target="_blank">
                  Pay
                </a>
              ) : null}
            </div>
          </div>
        ))}
        {invoices.length === 0 ? <p className="cp-muted">No invoices yet.</p> : null}
      </div>
    </div>
  );
}
