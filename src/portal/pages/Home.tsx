import { Link } from "react-router-dom";
import { usePortal, usePortalCollection } from "../PortalContext";
import type { ActivityView, ApprovalView, ProjectView } from "../../lib/clientPortal/types";

export function PortalHomePage() {
  const { t, member, meta } = usePortal();
  const projects = usePortalCollection<ProjectView>("projects");
  const approvals = usePortalCollection<ApprovalView>("approvals", "requestedAt");
  const activity = usePortalCollection<ActivityView>("activity", "at", 12);
  const pending = approvals.filter((a) => a.status === "pending");
  const name = String(member?.name || member?.email || "");
  const sentence =
    pending.length > 0
      ? `${pending.length === 1 ? "One thing needs" : `${pending.length} things need`} your decision this week. ${t("onTrack")}`
      : t("onTrack");

  return (
    <div className="cp-grid">
      <section>
        <h1 style={{ margin: "0 0 6px", fontSize: 28 }}>
          {t("greeting")}{name ? `, ${name.split(" ")[0]}` : ""}
        </h1>
        <p className="cp-muted" style={{ marginTop: 0 }}>
          {sentence}
        </p>
      </section>

      {pending.length > 0 ? (
        <section className="cp-card">
          <h2 style={{ marginTop: 0, fontSize: 16 }}>{t("needsAction")}</h2>
          {pending.map((a) => (
            <div className="cp-row" key={a.id}>
              <div>
                <strong>{a.title}</strong>
                <div className="cp-muted">{a.kind} · {a.dueAt || "—"}</div>
              </div>
              <Link className="cp-btn" to="/portal/approvals">
                {t("review")}
              </Link>
            </div>
          ))}
        </section>
      ) : null}

      <section>
        <h2 style={{ fontSize: 16 }}>{t("yourProjects")}</h2>
        {projects.length === 0 ? (
          <div className="cp-card cp-muted">{t("emptyProjects")}</div>
        ) : (
          <div className="cp-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
            {projects.map((p) => (
              <Link className="cp-card" key={p.id} to={`/portal/projects/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{p.name}</strong>
                  <span className="cp-pill">
                    <i className={`cp-health ${p.health || ""}`} />
                    {p.health || "—"}
                  </span>
                </div>
                <div className="cp-muted" style={{ margin: "8px 0" }}>
                  {p.stage || "—"} · {p.phase || "—"}
                </div>
                <div className="cp-progress">
                  <span style={{ width: `${Math.min(100, Math.max(0, p.progressPct || 0))}%` }} />
                </div>
                {p.nextCheckpoint ? (
                  <div className="cp-muted" style={{ marginTop: 8 }}>
                    Next: {p.nextCheckpoint.title}
                  </div>
                ) : null}
                {(meta?.nav?.approvals || 0) > 0 ? (
                  <div className="cp-muted" style={{ marginTop: 6 }}>
                    {t("waitingOnYou")}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="cp-card">
        <h2 style={{ marginTop: 0, fontSize: 16 }}>{t("recent")}</h2>
        {activity.length === 0 ? (
          <p className="cp-muted">—</p>
        ) : (
          activity.map((row) => (
            <div className="cp-row" key={row.id}>
              <div>
                <strong>{row.title}</strong>
                <div className="cp-muted">{row.kind} · {row.at?.slice(0, 10)}</div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
