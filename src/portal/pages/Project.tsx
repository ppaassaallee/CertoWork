import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../lib/firebase";
import { usePortal, usePortalCollection } from "../PortalContext";
import type {
  DocumentView,
  InvoiceView,
  ItemView,
  ProjectView,
  TimelineView,
  UpdateView,
} from "../../lib/clientPortal/types";

export function PortalProjectsPage() {
  const { t } = usePortal();
  const projects = usePortalCollection<ProjectView>("projects");
  return (
    <div className="cp-grid">
      <h1 style={{ margin: 0 }}>{t("projects")}</h1>
      {projects.map((p) => (
        <Link className="cp-card" key={p.id} to={`/portal/projects/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <strong>{p.name}</strong>
          <div className="cp-muted">{p.stage} · {p.health}</div>
        </Link>
      ))}
      {projects.length === 0 ? <div className="cp-card cp-muted">{t("emptyProjects")}</div> : null}
    </div>
  );
}

export function PortalProjectPage() {
  const { projectId = "" } = useParams();
  const { t, clientId, meta } = usePortal();
  const projects = usePortalCollection<ProjectView>("projects");
  const updates = usePortalCollection<UpdateView>("updates", "publishedAt");
  const items = usePortalCollection<ItemView>("items");
  const documents = usePortalCollection<DocumentView>("documents");
  const invoices = usePortalCollection<InvoiceView>("invoices");
  const timelines = usePortalCollection<TimelineView & { id: string }>("timeline");
  const [tab, setTab] = useState("overview");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const projectUpdates = updates.filter((u) => u.projectId === projectId);
  const timeline = timelines.find((row) => row.id === projectId || row.projectId === projectId);
  const projectItems = items.filter((i) => i.projectId === projectId);
  const projectDocs = documents.filter((d) => d.projectId === projectId);
  const projectInvoices = invoices.filter((i) => i.projectId === projectId);
  const latest = projectUpdates[0];
  const askEnabled = project?.visibility?.askOdysseus !== false;

  const tabs = useMemo(
    () => [
      ["overview", t("overview")],
      ["updates", t("updates")],
      ["timeline", t("timeline")],
      ["requests", t("requests")],
      ["documents", t("documents")],
      ["invoices", t("invoices")],
      ["messages", t("messages")],
    ],
    [t],
  );

  const ask = async () => {
    if (!question.trim() || !clientId) return;
    setAsking(true);
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "portalAsk");
      const res = await fn({ clientId, projectId, question });
      setAnswer(String((res.data as any)?.answer || ""));
    } catch (err) {
      setAnswer(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setAsking(false);
    }
  };

  if (!project) {
    return <div className="cp-card cp-muted">Project not found.</div>;
  }

  return (
    <div className="cp-grid">
      <div className="cp-muted">
        <Link to="/portal/projects">{t("projects")}</Link> / {project.name}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 8px" }}>{project.name}</h1>
          <span className="cp-pill">
            <i className={`cp-health ${project.health || ""}`} />
            {project.health || "—"}
          </span>
        </div>
        <div className="cp-muted">
          {project.stage} · {Math.round(project.progressPct || 0)}% · PM {project.pm?.name || "—"}
        </div>
      </div>

      <div className="cp-tabs">
        {tabs.map(([id, label]) => (
          <button className={tab === id ? "is-active" : ""} key={id} onClick={() => setTab(id)} type="button">
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="cp-grid cp-grid-2">
          <div className="cp-grid">
            <section className="cp-card">
              <h2 style={{ marginTop: 0, fontSize: 16 }}>{latest?.title || "This week's update"}</h2>
              <p>{latest?.summary || "No published update yet."}</p>
              {latest ? (
                <>
                  <h3 style={{ fontSize: 13 }}>Done</h3>
                  <ul>{latest.done.map((x) => <li key={x}>{x}</li>)}</ul>
                  <h3 style={{ fontSize: 13 }}>Next</h3>
                  <ul>{latest.next.map((x) => <li key={x}>{x}</li>)}</ul>
                  <h3 style={{ fontSize: 13 }}>Needs you</h3>
                  <ul>{latest.needsClient.map((x) => <li key={x.text}>{x.text}</li>)}</ul>
                </>
              ) : null}
            </section>
            <section className="cp-card">
              <h2 style={{ marginTop: 0, fontSize: 16 }}>{t("timeline")}</h2>
              {(timeline?.items || []).map((item) => (
                <div className="cp-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <div className="cp-muted">{item.kind}</div>
                  </div>
                  <span className="cp-pill">{item.status}</span>
                </div>
              ))}
            </section>
            {askEnabled ? (
              <section className="cp-card">
                <h2 style={{ marginTop: 0, fontSize: 16 }}>{t("askProject")}</h2>
                <div className="cp-muted" style={{ marginBottom: 8 }}>
                  Suggested: What do you need from me? · When is go-live? · Summarize the last 3 updates
                </div>
                <textarea
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t("askPlaceholder")}
                  rows={3}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid var(--c-line)", padding: 10 }}
                  value={question}
                />
                <button className="cp-btn" disabled={asking} onClick={ask} type="button" style={{ marginTop: 8 }}>
                  {t("askSend")}
                </button>
                {answer ? <p style={{ whiteSpace: "pre-wrap" }}>{answer}</p> : null}
              </section>
            ) : null}
          </div>
          <div className="cp-grid">
            <section className="cp-card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h2 style={{ marginTop: 0, fontSize: 16 }}>{t("requests")}</h2>
                <Link className="cp-btn secondary" to="/portal/requests">{t("newRequest")}</Link>
              </div>
              {projectItems.filter((i) => i.kind === "request").slice(0, 5).map((i) => (
                <div className="cp-row" key={i.id}>
                  <div>
                    <strong>{i.title}</strong>
                    <div className="cp-muted">{i.status}</div>
                  </div>
                </div>
              ))}
            </section>
            <section className="cp-card">
              <h2 style={{ marginTop: 0, fontSize: 16 }}>{t("documents")}</h2>
              {projectDocs.slice(0, 5).map((d) => (
                <div className="cp-row" key={d.id}>
                  <strong>{d.name}</strong>
                  <span className="cp-muted">{d.mime || ""}</span>
                </div>
              ))}
            </section>
            <section className="cp-card">
              <h2 style={{ marginTop: 0, fontSize: 16 }}>{t("invoices")}</h2>
              <div className="cp-muted">
                Pending {project.invoiceSummary?.pending || 0} · Overdue {project.invoiceSummary?.overdue || 0}
              </div>
              {projectInvoices.slice(0, 3).map((inv) => (
                <div className="cp-row" key={inv.id}>
                  <span className="cp-mono">{inv.number}</span>
                  <span>{inv.amount} {inv.currency}</span>
                </div>
              ))}
            </section>
            <section className="cp-card">
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Your team</h2>
              {(project.team || []).concat(project.pm ? [project.pm] : []).map((person, idx) => (
                <div className="cp-row" key={`${person.name}-${idx}`}>
                  <strong>{person.name}</strong>
                  <span className="cp-muted">{person.title || "—"}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      ) : null}

      {tab === "updates" ? (
        <div className="cp-grid">
          {projectUpdates.map((u) => (
            <article className="cp-card" key={u.id}>
              <div className="cp-pill">{u.period?.from} → {u.period?.to}</div>
              <h3>{u.title}</h3>
              <p>{u.summary}</p>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "timeline" ? (
        <div className="cp-card">
          {(timeline?.items || []).map((item) => (
            <div className="cp-row" key={item.id}>
              <strong>{item.title}</strong>
              <span className="cp-pill">{item.status}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="cp-card">
          {projectItems.filter((i) => i.kind === "request").map((i) => (
            <div className="cp-row" key={i.id}>
              <div>
                <strong>{i.requestNumber || i.title}</strong>
                <div className="cp-muted">{i.lastPublicUpdate || "—"}</div>
              </div>
              <span className="cp-pill">{i.status}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="cp-card">
          {projectDocs.map((d) => (
            <div className="cp-row" key={d.id}>
              <strong>{d.name}</strong>
              <span className="cp-muted">{d.signed ? "Signed" : ""}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "invoices" ? (
        <div className="cp-card">
          {projectInvoices.map((inv) => (
            <div className="cp-row" key={inv.id}>
              <span className="cp-mono">{inv.number}</span>
              <span className="cp-pill">{inv.status}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "messages" ? (
        <div className="cp-card">
          <Link to="/portal/messages">Open messages</Link>
          <div className="cp-muted" style={{ marginTop: 8 }}>
            Unread nav: {meta?.nav?.messages || 0}
          </div>
        </div>
      ) : null}
    </div>
  );
}
