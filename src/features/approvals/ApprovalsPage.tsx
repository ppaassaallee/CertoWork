import { useState } from "react";
import { CheckCircle2, ShieldCheck, Sparkles } from "../../components/ui/Icon";
import { getLocale } from "../../lib/i18n";
import "./approvals.css";

type Review = {
  id: string;
  title?: string;
  type?: string;
  sourceType?: string;
  status?: string;
  why?: string;
  action?: string;
  proposed?: Record<string, unknown>;
  createdAt?: { seconds?: number } | string;
};

export function ApprovalsPage({
  pending,
  history,
  onDecide,
  onEdit,
}: {
  pending: Review[];
  history: Review[];
  onDecide: (item: Review, decision: "approve" | "dismiss") => void;
  onEdit: (item: Review) => void;
}) {
  const locale = getLocale();
  const es = locale === "es";
  const [tab, setTab] = useState<"pending" | "approved" | "dismissed">("pending");
  const rows = tab === "pending" ? pending : history.filter((item) => item.status === tab);
  const groups = rows.reduce<Record<string, Review[]>>((result, item) => {
    const source = item.sourceType || (item.type?.includes("agent") ? "agent" : "workspace");
    (result[source] ||= []).push(item);
    return result;
  }, {});

  return (
    <main className="cw-approvals-page" data-testid="approvals-page">
      <header className="cw-approvals-header">
        <h1>{es ? "Aprobaciones" : "Approvals"}</h1>
        <p>{es ? "Los cambios esperan tu decisión antes de aplicarse." : "Changes wait for your decision before they are applied."}</p>
      </header>
      <nav className="cw-approvals-tabs" aria-label={es ? "Estado" : "Status"}>
        {([
          ["pending", es ? "Pendientes" : "Pending", pending.length],
          ["approved", es ? "Aprobadas" : "Approved", history.filter((item) => item.status === "approved").length],
          ["dismissed", es ? "Rechazadas" : "Rejected", history.filter((item) => item.status === "dismissed").length],
        ] as const).map(([id, label, count]) => (
          <button className={tab === id ? "is-active" : ""} key={id} onClick={() => setTab(id)} type="button">
            {label}{count > 0 ? <span>{count}</span> : null}
          </button>
        ))}
      </nav>
      {rows.length === 0 ? (
        <div className="cw-approvals-empty">
          <CheckCircle2 size={28} />
          <strong>{tab === "pending" ? (es ? "No hay cambios pendientes." : "No pending changes.") : (es ? "No hay cambios aquí." : "No changes here yet.")}</strong>
          <p>{es ? "Las nuevas propuestas aparecerán aquí antes de modificar tu espacio." : "New proposals will appear here before changing your workspace."}</p>
        </div>
      ) : Object.entries(groups).map(([source, group]) => (
        <section className="cw-approvals-group" key={source}>
          <h2>{source === "odiseus" ? "Odysseus" : source === "agent" ? (es ? "Agentes" : "Agents") : (es ? "Espacio de trabajo" : "Workspace")}</h2>
          <div className="cw-approvals-list">
            {(group || []).map((item) => (
              <article className="cw-approval-row" key={item.id}>
                <span className="cw-approval-icon">{source === "odiseus" ? <Sparkles size={18} /> : <ShieldCheck size={18} />}</span>
                <div className="cw-approval-body">
                  <strong>{item.title || (es ? "Cambio propuesto" : "Proposed change")}</strong>
                  <small>{item.type || (es ? "Cambio" : "Change")}</small>
                  <p>{item.why || item.action || (es ? "Propuesta para revisar." : "Proposal for review.")}</p>
                  <details>
                    <summary>{es ? "Ver detalles" : "View details"}</summary>
                    <pre>{JSON.stringify(item.proposed || {}, null, 2)}</pre>
                  </details>
                </div>
                {tab === "pending" && <div className="cw-approval-actions">
                  <button className="cw-approval-primary" onClick={() => onDecide(item, "approve")} type="button">{es ? "Aprobar" : "Approve"}</button>
                  <button onClick={() => onDecide(item, "dismiss")} type="button">{es ? "Rechazar" : "Reject"}</button>
                  <button onClick={() => onEdit(item)} type="button">{es ? "Editar" : "Edit"}</button>
                </div>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
