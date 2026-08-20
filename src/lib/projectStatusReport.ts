import { projectHealth, projectHealthLabel, projectStatusLabel } from "./projectPortfolio";
import { deliveryPhaseLabel, deliveryStageLabels, normalizeDeliveryStage } from "./projectDelivery";

function asDate(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  return "";
}

export function buildProjectStatusReport(project: any, tasks: any[] = [], risks: any[] = [], milestones: any[] = []) {
  const projectTasks = tasks.filter((item) => item.projectId === project.id);
  const executable = projectTasks.filter((item) =>
    ["pbi", "story", "task", "bug", "subtask"].includes(String(item.workItemType || item.type || "").toLowerCase()),
  );
  const done = executable.filter((item) => ["done", "completed"].includes(String(item.status || "").toLowerCase()));
  const epics = projectTasks.filter((item) => String(item.workItemType || item.type || "").toLowerCase() === "epic");
  const openRisks = risks.filter(
    (risk) =>
      risk.projectId === project.id &&
      !["closed", "resolved", "accepted"].includes(String(risk.status || "open").toLowerCase()),
  );
  const blockers = projectTasks.filter((item) => String(item.status || "").toLowerCase() === "blocked");
  const health = projectHealth(project, projectTasks, openRisks);
  return {
    title: project.title || project.name || "Untitled project",
    manager: project.projectManager || "Unassigned",
    status: projectStatusLabel(project.status),
    stage: deliveryStageLabels[normalizeDeliveryStage(project)],
    phase: deliveryPhaseLabel(project),
    target: asDate(project.targetDate || project.dueDate || project.revisedDueDate),
    progress: executable.length ? Math.round((done.length / executable.length) * 100) : 0,
    health: projectHealthLabel(health),
    healthKey: health,
    outcome: project.outcome || project.objective || project.description || "",
    epics: epics.map((item) => ({
      title: item.title || item.name || "Epic",
      due: asDate(item.dueDate || item.targetDate),
      status: item.status || "backlog",
      owner: item.owner || item.assignee || "",
    })),
    milestones: milestones
      .filter((item) => item.projectId === project.id)
      .map((item) => ({
        title: item.title || item.name || "Milestone",
        due: asDate(item.dueDate || item.targetDate),
        status: item.status || "open",
      })),
    risks: openRisks.map((item) => ({
      title: item.title || item.description || "Risk",
      severity: item.severity || "medium",
      response: item.response || item.mitigation || "",
    })),
    blockers: blockers.map((item) => item.title || item.name || "Blocked item"),
    nextAction: project.nextAction || "",
  };
}

export function createShareToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function sanitizeStatusReportSnapshot(report: ReturnType<typeof buildProjectStatusReport>) {
  return {
    title: String(report.title || "Untitled project"),
    manager: String(report.manager || "Unassigned"),
    status: String(report.status || ""),
    stage: String(report.stage || ""),
    phase: String(report.phase || ""),
    target: String(report.target || ""),
    progress: Number(report.progress || 0),
    health: String(report.health || ""),
    healthKey: String(report.healthKey || ""),
    outcome: String(report.outcome || ""),
    epics: (report.epics || []).slice(0, 40).map((item) => ({
      title: String(item.title || "Epic"),
      due: String(item.due || ""),
      status: String(item.status || ""),
      owner: String(item.owner || ""),
    })),
    milestones: (report.milestones || []).slice(0, 40).map((item) => ({
      title: String(item.title || "Milestone"),
      due: String(item.due || ""),
      status: String(item.status || ""),
    })),
    risks: (report.risks || []).slice(0, 40).map((item) => ({
      title: String(item.title || "Risk"),
      severity: String(item.severity || "medium"),
      response: String(item.response || ""),
    })),
    blockers: (report.blockers || []).slice(0, 40).map((item) => String(item)),
    nextAction: String(report.nextAction || ""),
  };
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function projectStatusReportHtml(report: ReturnType<typeof buildProjectStatusReport>) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)} · Status report</title>
<style>
@page{size:A4;margin:14mm}
body{margin:0;color:#24352c;font:13px Inter,Arial,sans-serif}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #214b39;padding-bottom:12px;margin-bottom:16px}
.kicker{color:#5d7467;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
h1{margin:4px 0 0;font-size:26px;letter-spacing:-.04em}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.card{border:1px solid #dce5df;border-radius:12px;padding:10px 12px}
.card span{display:block;color:#718078;font-size:10px;font-weight:800;text-transform:uppercase}
.card strong{font-size:16px}
table{width:100%;border-collapse:collapse;margin:8px 0 16px}
th,td{padding:8px 6px;border-bottom:1px solid #e4ebe6;text-align:left;font-size:12px}
th{color:#6d7b72;font-size:10px;text-transform:uppercase}
.health{display:inline-block;border-radius:999px;padding:2px 8px;background:#eaf4ee;font-size:11px}
</style></head><body>
<header><div><div class="kicker">Certo Work · Project status</div><h1>${escapeHtml(report.title)}</h1></div>
<div>${escapeHtml(report.status)} · ${escapeHtml(report.stage)} · <span class="health">${escapeHtml(report.health)}</span></div></header>
<div class="grid">
<div class="card"><span>Project manager</span><strong>${escapeHtml(report.manager)}</strong></div>
<div class="card"><span>Target</span><strong>${escapeHtml(report.target || "—")}</strong></div>
<div class="card"><span>Progress</span><strong>${report.progress}%</strong></div>
<div class="card"><span>Phase</span><strong>${escapeHtml(report.phase)}</strong></div>
</div>
<p>${escapeHtml(report.outcome || "No outcome recorded.")}</p>
<h2>Milestones / Epics</h2>
<table><thead><tr><th>Item</th><th>Due</th><th>Status</th></tr></thead><tbody>
${[...report.epics, ...report.milestones].map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.due || "—")}</td><td>${escapeHtml(item.status)}</td></tr>`).join("") || "<tr><td colspan=3>None recorded</td></tr>"}
</tbody></table>
<h2>Risks</h2>
<table><thead><tr><th>Risk</th><th>Severity</th><th>Response</th></tr></thead><tbody>
${report.risks.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.severity)}</td><td>${escapeHtml(item.response)}</td></tr>`).join("") || "<tr><td colspan=3>No open risks</td></tr>"}
</tbody></table>
<h2>Blockers</h2>
<p>${report.blockers.length ? report.blockers.map(escapeHtml).join("<br>") : "No blocked items."}</p>
<p><strong>Next action:</strong> ${escapeHtml(report.nextAction || "Not recorded")}</p>
</body></html>`;
}

export function downloadProjectStatusReport(report: ReturnType<typeof buildProjectStatusReport>) {
  if (typeof window === "undefined") return;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!popup) return;
  popup.document.write(projectStatusReportHtml(report));
  popup.document.close();
  popup.focus();
  popup.print();
}
