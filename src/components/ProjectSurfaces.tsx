import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Circle,
  FileText,
  Flag,
  FolderKanban,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Star,
  Target,
  Users,
  X,
} from "lucide-react";
import {
  PROJECT_HEALTH,
  PROJECT_STATUSES,
  isProjectFavorite,
  projectHealth,
  projectHealthLabel,
  projectStatusLabel,
  sortProjectsByRecency,
  taskWorkLane,
  type WorkLane,
} from "../lib/projectPortfolio";
import { CodexBridgePanel } from "./CodexBridgePanel";
import { InfoTip, MultiAssigneePicker, memberName } from "./ProjectControls";

type ProjectPatch = Record<string, unknown>;
type AssignmentMember = { id: string; displayName?: string; email?: string; emailLower?: string; status?: string };

type SharedProjectActions = {
  onUpdateProject: (projectId: string, patch: ProjectPatch) => Promise<void> | void;
  onArchiveProject: (project: any) => Promise<void> | void;
  onOpenProject: (project: any) => void;
  onDeleteProject?: (project: any) => Promise<void> | void;
  onRestoreProject?: (project: any) => Promise<void> | void;
};

function projectTitle(project: any) {
  return project?.title || project?.name || "Untitled project";
}

function healthClass(value: string) {
  return value === "blocked" ? "is-blocked" : value === "at_risk" ? "is-risk" : "is-track";
}

function EditableField({
  label,
  value,
  placeholder,
  multiline = false,
  onCommit,
}: {
  label: string;
  value?: string;
  placeholder: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value || "");
  const commit = () => {
    const next = draft.trim();
    if (next !== String(value || "").trim()) onCommit(next);
  };
  return (
    <label className={`do-project-field ${multiline ? "is-multiline" : ""}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea onBlur={commit} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} rows={3} value={draft} />
      ) : (
        <input onBlur={commit} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} value={draft} />
      )}
    </label>
  );
}

function ProjectStatusSelect({ project, onUpdate }: { project: any; onUpdate: (patch: ProjectPatch) => void }) {
  const value = PROJECT_STATUSES.includes(String(project.status || "planning") as any)
    ? String(project.status || "planning")
    : "active";
  return (
    <select aria-label={`Status for ${projectTitle(project)}`} className="do-project-select" onChange={(event) => onUpdate({ status: event.target.value })} value={value}>
      {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{projectStatusLabel(status)}</option>)}
    </select>
  );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="do-project-empty">{icon}<strong>{title}</strong><span>{text}</span></div>;
}

type WorkItemKind = "epic" | "feature" | "pbi" | "story" | "task" | "bug" | "subtask";

function workItemKind(item: any): WorkItemKind {
  const value = String(item?.workItemType || item?.itemType || item?.taskType || item?.issueType || item?.kind || "").toLowerCase();
  if (value.includes("epic")) return "epic";
  if (value.includes("feature")) return "feature";
  if (value.includes("subtask") || value.includes("sub_task")) return "subtask";
  if (value.includes("story")) return "story";
  if (value.includes("bug")) return "bug";
  if (value === "task" || value.includes("project_task")) return "task";
  return "pbi";
}

function workItemLabel(kind: WorkItemKind) {
  return kind === "pbi" ? "PBI" : kind.charAt(0).toUpperCase() + kind.slice(1);
}

function workItemParentId(item: any) {
  return String(item?.parentId || item?.featureId || item?.epicId || "");
}

function itemOrder(item: any, fallback = 0) {
  const value = Number(item?.order ?? item?.rank ?? item?.position);
  return Number.isFinite(value) ? value : fallback;
}

function sortWorkItems(items: any[]) {
  return [...items].sort((left, right) => (
    itemOrder(left) - itemOrder(right) ||
    String(priorityValue(left.priority) === "N/A" ? "9" : priorityValue(left.priority)).localeCompare(String(priorityValue(right.priority) === "N/A" ? "9" : priorityValue(right.priority))) ||
    projectTitle(left).localeCompare(projectTitle(right))
  ));
}

function dateInputValue(value: any) {
  if (!value) return "";
  if (typeof value === "string") return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  return "";
}

function priorityValue(value: any) {
  const normalized = String(value || "").toUpperCase();
  if (["1", "P1", "HIGH", "URGENT", "CRITICAL"].includes(normalized)) return "1";
  if (["2", "P2", "MEDIUM"].includes(normalized)) return "2";
  if (["3", "P3", "LOW"].includes(normalized)) return "3";
  return "N/A";
}

function canonicalWorkStatus(item: any) {
  const status = String(item?.status || "").toLowerCase();
  if (["backlog", "ready", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"].includes(status)) return status;
  return taskWorkLane(item);
}

function InlineEdit({
  ariaLabel,
  value,
  placeholder,
  onCommit,
}: {
  ariaLabel: string;
  value?: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  return (
    <input
      aria-label={ariaLabel}
      onBlur={() => draft.trim() !== String(value || "").trim() && onCommit(draft.trim())}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      placeholder={placeholder}
      value={draft}
    />
  );
}

export function ProjectRecordModal({
  project,
  tasks,
  milestones,
  risks,
  documents,
  onClose,
  onAsk,
  onUpdateProject,
  onArchiveProject,
  onAddTask,
  onUpdateTask,
  onAddMilestone,
  onAddRisk,
}: {
  project: any;
  tasks: any[];
  milestones: any[];
  risks: any[];
  documents: any[];
  onClose: () => void;
  onAsk: (prompt: string) => void;
  onUpdateProject: SharedProjectActions["onUpdateProject"];
  onArchiveProject: SharedProjectActions["onArchiveProject"];
  onAddTask: (title: string, status: WorkLane, patch?: ProjectPatch) => Promise<void> | void;
  onUpdateTask: (taskId: string, patch: ProjectPatch) => Promise<void> | void;
  onAddMilestone: (title: string) => Promise<void> | void;
  onAddRisk: (title: string) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<"overview" | "plan" | "work" | "risks" | "docs" | "team">("overview");
  const [taskTitle, setTaskTitle] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [riskTitle, setRiskTitle] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const methodology = String(project.methodology || "scrum").toLowerCase();
  const currentHealth = projectHealth(project, tasks, risks);
  const openTasks = tasks.filter((task) => taskWorkLane(task) !== "done");
  const lanes = useMemo(() => ({
    backlog: tasks.filter((task) => taskWorkLane(task) === "backlog"),
    in_progress: tasks.filter((task) => taskWorkLane(task) === "in_progress"),
    blocked: tasks.filter((task) => taskWorkLane(task) === "blocked"),
    done: tasks.filter((task) => taskWorkLane(task) === "done"),
  }), [tasks]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const update = (patch: ProjectPatch) => onUpdateProject(project.id, patch);
  const submitTask = async () => {
    if (!taskTitle.trim()) return;
    await onAddTask(taskTitle.trim(), "backlog");
    setTaskTitle("");
  };

  return (
    <div aria-label={`${projectTitle(project)} project record`} aria-modal="true" className="do-project-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <section className="do-project-record" data-testid="project-record">
        <header className="do-project-record-head">
          <div className="do-project-record-title">
            <span className="do-project-record-icon"><FolderKanban size={20} /></span>
            <div>
              <span>PROJECT RECORD</span>
              <h1>{projectTitle(project)}</h1>
            </div>
          </div>
          <div className="do-project-record-actions">
            <button aria-label={isProjectFavorite(project) ? "Remove from favorites" : "Add to favorites"} className={isProjectFavorite(project) ? "is-favorite" : ""} onClick={() => update({ favorite: !isProjectFavorite(project) })} type="button"><Star fill={isProjectFavorite(project) ? "currentColor" : "none"} size={16} /></button>
            <ProjectStatusSelect onUpdate={update} project={project} />
            <button aria-label="Close project" onClick={onClose} type="button"><X size={18} /></button>
          </div>
        </header>

        <div className="do-project-record-summary">
          <div><Target size={15} /><span><strong>{project.outcome || project.objective || "Outcome needs definition"}</strong><small>Target outcome</small></span></div>
          <div><ListChecks size={15} /><span><strong>{openTasks.length}</strong><small>Open work items</small></span></div>
          <div><Flag size={15} /><span><strong>{milestones.filter((item) => String(item.status || "").toLowerCase() !== "completed").length}</strong><small>Open milestones</small></span></div>
          <div className={healthClass(currentHealth)}><AlertTriangle size={15} /><span><strong>{projectHealthLabel(currentHealth)}</strong><small>Current health</small></span></div>
        </div>

        <nav className="do-project-tabs" aria-label="Project sections">
          {([
            ["overview", "Overview"], ["plan", "Plan"], ["work", "Work"], ["risks", "Risks"], ["docs", "Docs"], ["team", "Team"],
          ] as const).map(([value, label]) => <button className={tab === value ? "is-active" : ""} key={value} onClick={() => setTab(value)} type="button">{label}{value === "risks" && risks.length > 0 ? <small>{risks.length}</small> : value === "docs" && documents.length > 0 ? <small>{documents.length}</small> : null}</button>)}
        </nav>

        <div className="do-project-record-body">
          {tab === "overview" && (
            <div className="do-project-overview">
              <section className="do-project-card do-project-card-large">
                <span className="do-project-card-kicker">DIRECTION</span>
                <EditableField label="Outcome" multiline onCommit={(outcome) => update({ outcome })} placeholder="What will be observably different when this is done?" value={project.outcome || project.objective} />
                <EditableField label="Why it matters" multiline onCommit={(description) => update({ description })} placeholder="Give the team enough context to make good decisions." value={project.description} />
              </section>
              <section className="do-project-card">
                <span className="do-project-card-kicker">CLASSIFICATION</span>
                <label className="do-project-field"><span>Method</span><select onChange={(event) => update({ methodology: event.target.value })} value={methodology}><option value="scrum">Scrum</option><option value="pmi">PMI</option><option value="hybrid">Hybrid</option></select></label>
                <EditableField label="Type" onCommit={(projectType) => update({ projectType })} placeholder="Product, client, operations…" value={project.projectType || project.category} />
                <EditableField label="Priority" onCommit={(priority) => update({ priority })} placeholder="High, medium, low" value={project.priority} />
              </section>
              <section className="do-project-card">
                <span className="do-project-card-kicker">OWNERSHIP & DATES</span>
                <EditableField label="Project manager" onCommit={(projectManager) => update({ projectManager })} placeholder="Name or email" value={project.projectManager || project.owner} />
                <EditableField label="Target date" onCommit={(targetDate) => update({ targetDate })} placeholder="YYYY-MM-DD" value={project.targetDate || project.dueDate} />
                <label className="do-project-field"><span>Health</span><select onChange={(event) => update({ health: event.target.value })} value={currentHealth}>{PROJECT_HEALTH.map((health) => <option key={health} value={health}>{projectHealthLabel(health)}</option>)}</select></label>
              </section>
              <section className="do-project-card do-project-ai-card">
                <Sparkles size={17} />
                <div><strong>Plan this with Certo Work</strong><p>Use the conversation to challenge assumptions or turn this record into a credible plan.</p></div>
                <button onClick={() => { onClose(); onAsk(`Review ${projectTitle(project)} and tell me the most important decision, risk, and next action.`); }} type="button">Ask <ArrowRight size={13} /></button>
              </section>
            </div>
          )}

          {tab === "plan" && (
            <div className="do-project-plan">
              <section className="do-project-card do-plan-hero">
                <div><span className="do-project-card-kicker">DELIVERY METHOD</span><h2>{methodology === "pmi" ? "PMI delivery plan" : methodology === "hybrid" ? "Hybrid delivery plan" : "Scrum delivery plan"}</h2><p>{methodology === "pmi" ? "Manage scope, milestones, governance, delivery and closeout." : "Keep one prioritized backlog, a clear sprint goal, and visible blockers."}</p></div>
                <select onChange={(event) => update({ methodology: event.target.value })} value={methodology}><option value="scrum">Scrum</option><option value="pmi">PMI</option><option value="hybrid">Hybrid</option></select>
              </section>
              {methodology === "pmi" ? (
                <div className="do-pmi-phases">
                  {["Initiating", "Planning", "Executing", "Monitoring", "Closing"].map((phase, index) => <div className={index === Math.min(4, PROJECT_STATUSES.indexOf(String(project.status) as any)) ? "is-current" : ""} key={phase}><span>{index + 1}</span><strong>{phase}</strong><small>{index === 0 ? "Charter & stakeholders" : index === 1 ? "Scope & schedule" : index === 2 ? "Delivery" : index === 3 ? "Control & risks" : "Handover"}</small></div>)}
                </div>
              ) : (
                <section className="do-project-card">
                  <EditableField label="Sprint goal" multiline onCommit={(sprintGoal) => update({ sprintGoal })} placeholder="What should the team prove or deliver in the current sprint?" value={project.sprintGoal} />
                  <div className="do-scrum-metrics"><span><strong>{lanes.backlog.length}</strong> Backlog</span><span><strong>{lanes.in_progress.length}</strong> In sprint</span><span><strong>{lanes.blocked.length}</strong> Blocked</span><span><strong>{lanes.done.length}</strong> Done</span></div>
                </section>
              )}
              <section className="do-project-card">
                <div className="do-project-card-head"><div><span className="do-project-card-kicker">MILESTONES</span><h2>Key delivery points</h2></div><Flag size={16} /></div>
                <div className="do-milestone-list">
                  {milestones.map((milestone) => <div key={milestone.id}><span className={String(milestone.status).toLowerCase() === "completed" ? "is-done" : ""}><Flag size={12} /></span><strong>{milestone.title || milestone.name}</strong><small>{milestone.dueDate || milestone.targetDate || "No date"}</small></div>)}
                  {milestones.length === 0 && <EmptyState icon={<Flag size={18} />} title="No milestones yet" text="Add the first meaningful delivery point." />}
                </div>
                <div className="do-project-inline-add"><input onChange={(event) => setMilestoneTitle(event.target.value)} onKeyDown={async (event) => { if (event.key === "Enter" && milestoneTitle.trim()) { await onAddMilestone(milestoneTitle.trim()); setMilestoneTitle(""); } }} placeholder="Add a milestone…" value={milestoneTitle} /><button disabled={!milestoneTitle.trim()} onClick={async () => { await onAddMilestone(milestoneTitle.trim()); setMilestoneTitle(""); }} type="button"><Plus size={13} /> Add</button></div>
              </section>
            </div>
          )}

          {tab === "work" && (
            <div className="do-project-work">
              <div className="do-work-toolbar"><div><span className="do-project-card-kicker">TEAM EXECUTION</span><h2>{methodology === "scrum" ? "Backlog & current flow" : "Work breakdown & delivery flow"}</h2></div><div className="do-project-inline-add"><input onChange={(event) => setTaskTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitTask()} placeholder="Add a work item…" value={taskTitle} /><button disabled={!taskTitle.trim()} onClick={submitTask} type="button"><Plus size={13} /> Add</button></div></div>
              <div className="do-work-board">
                {([
                  ["backlog", "Backlog"], ["in_progress", "In progress"], ["blocked", "Blocked"], ["done", "Done"],
                ] as const).map(([lane, label]) => <section className={`do-work-lane is-${lane}`} key={lane}><header><span>{label}</span><small>{lanes[lane].length}</small></header><div>{lanes[lane].map((task) => <article key={task.id}><strong>{task.title || task.name}</strong>{task.assignee && <small>{task.assignee}</small>}<select aria-label={`Move ${task.title || "task"}`} onChange={(event) => onUpdateTask(task.id, { status: event.target.value })} value={lane}><option value="backlog">Backlog</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select></article>)}{lanes[lane].length === 0 && <span className="do-lane-empty">No work here</span>}</div></section>)}
              </div>
            </div>
          )}

          {tab === "risks" && (
            <div className="do-project-risks">
              <section className={`do-risk-banner ${healthClass(currentHealth)}`}><AlertTriangle size={20} /><div><strong>{projectHealthLabel(currentHealth)}</strong><p>{currentHealth === "on_track" ? "No active project-level risk is currently forcing a change." : "This project needs a visible owner and response for the issues below."}</p></div><select aria-label="Project health" onChange={(event) => update({ health: event.target.value })} value={currentHealth}>{PROJECT_HEALTH.map((health) => <option key={health} value={health}>{projectHealthLabel(health)}</option>)}</select></section>
              <section className="do-project-card">
                <div className="do-project-card-head"><div><span className="do-project-card-kicker">RISK REGISTER</span><h2>Threats, assumptions and blockers</h2></div><AlertTriangle size={16} /></div>
                <div className="do-risk-list">
                  {risks.map((risk) => <div key={risk.id}><span className="is-risk"><AlertTriangle size={12} /></span><div><strong>{risk.title || risk.description}</strong><small>{risk.response || risk.mitigation || "Response needs definition"}</small></div><em>{risk.owner || "Unassigned"}</em></div>)}
                  {lanes.blocked.map((task) => <div key={`task-${task.id}`}><span className="is-blocked"><Circle size={12} /></span><div><strong>{task.title}</strong><small>Blocked work item</small></div><em>{task.assignee || "Unassigned"}</em></div>)}
                  {risks.length === 0 && lanes.blocked.length === 0 && <EmptyState icon={<CheckCircle2 size={19} />} title="No open risks" text="Keep this honest: add a risk as soon as it can affect scope, time or outcome." />}
                </div>
                <div className="do-project-inline-add"><input onChange={(event) => setRiskTitle(event.target.value)} onKeyDown={async (event) => { if (event.key === "Enter" && riskTitle.trim()) { await onAddRisk(riskTitle.trim()); setRiskTitle(""); } }} placeholder="Describe a risk or assumption…" value={riskTitle} /><button disabled={!riskTitle.trim()} onClick={async () => { await onAddRisk(riskTitle.trim()); setRiskTitle(""); }} type="button"><Plus size={13} /> Add risk</button></div>
              </section>
            </div>
          )}

          {tab === "docs" && (
            <div className="do-project-documents">
              <section className="do-project-card">
                <div className="do-project-card-head"><div><span className="do-project-card-kicker">PROJECT KNOWLEDGE</span><h2>Requirements and working documents</h2></div><FileText size={17} /></div>
                <p className="do-project-card-copy">Documents saved here stay attached to this project and can ground future project conversations.</p>
                <div className="do-project-document-list">
                  {documents.map((document) => {
                    const content = String(document.content || document.body || document.description || "");
                    return <article key={document.id}><span><FileText size={15} /></span><div><small>{document.docType || document.type || "Document"}</small><strong>{document.title || document.name || "Untitled document"}</strong><p>{document.summary || content.slice(0, 260) || "No summary recorded."}</p></div><button onClick={() => { onClose(); onAsk(`Using ${document.title || "this project document"}, help me move ${projectTitle(project)} forward.`); }} type="button">Ask about it <ArrowRight size={12} /></button></article>;
                  })}
                  {documents.length === 0 && <EmptyState icon={<FileText size={19} />} title="No project documents yet" text="Paste a PRD or specification in the project conversation and ask Certo Work to add it here." />}
                </div>
              </section>
            </div>
          )}

          {tab === "team" && (
            <div className="do-project-team">
              <section className="do-project-card do-project-card-large">
                <div className="do-project-card-head"><div><span className="do-project-card-kicker">TEAM CHARTER</span><h2>Ownership and ways of working</h2></div><Users size={17} /></div>
                <div className="do-project-field-grid"><EditableField label="Project manager / Scrum Master" onCommit={(projectManager) => update({ projectManager })} placeholder="Name or email" value={project.projectManager || project.scrumMaster} /><EditableField label="Sponsor / Product Owner" onCommit={(sponsor) => update({ sponsor })} placeholder="Name or email" value={project.sponsor || project.productOwner} /></div>
                <EditableField label="Team members" multiline onCommit={(teamMembers) => update({ teamMembers })} placeholder="Names or emails, separated by commas" value={Array.isArray(project.teamMembers) ? project.teamMembers.join(", ") : project.teamMembers} />
                <EditableField label="Definition of done" multiline onCommit={(definitionOfDone) => update({ definitionOfDone })} placeholder="What must be true before work is considered complete?" value={project.definitionOfDone} />
              </section>
              <section className="do-project-card do-team-guidance"><Users size={18} /><h2>Ready for team planning</h2><p>This record now holds the outcome, method, work, milestones, risks, and ownership in one place. Use the Work tab for Jira-like execution and the Plan tab for Scrum or PMI governance.</p><button onClick={() => { onClose(); onAsk(`Create a complete ${methodology.toUpperCase()} planning agenda for ${projectTitle(project)} with roles, milestones, risks, dependencies, and next actions.`); }} type="button"><MessageSquare size={14} /> Plan with the team</button></section>
              <section className="do-project-card do-project-danger"><div><Archive size={16} /><span><strong>Archive project</strong><small>Removes it from active lists without deleting its history.</small></span></div>{archiveConfirm ? <div><button onClick={() => setArchiveConfirm(false)} type="button">Cancel</button><button onClick={() => onArchiveProject(project)} type="button">Confirm archive</button></div> : <button onClick={() => setArchiveConfirm(true)} type="button">Archive</button>}</section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function ProjectConsolePanel({
  project,
  tasks,
  milestones,
  risks,
  documents,
  workspaceMembers = [],
  conversationId,
  onAsk,
  onUpdateProject,
  onArchiveProject,
  onDeleteProject,
  onRestoreProject,
  onAddTask,
  onUpdateTask,
  onAddRisk,
}: {
  project: any;
  tasks: any[];
  milestones: any[];
  risks: any[];
  documents: any[];
  workspaceMembers?: AssignmentMember[];
  conversationId?: string | null;
  onAsk: (prompt: string) => void;
  onUpdateProject: SharedProjectActions["onUpdateProject"];
  onArchiveProject: SharedProjectActions["onArchiveProject"];
  onDeleteProject?: SharedProjectActions["onDeleteProject"];
  onRestoreProject?: SharedProjectActions["onRestoreProject"];
  onAddTask: (title: string, status: WorkLane, patch?: ProjectPatch) => Promise<void> | void;
  onUpdateTask: (taskId: string, patch: ProjectPatch) => Promise<void> | void;
  onAddRisk: (title: string, patch?: ProjectPatch) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<"brief" | "backlog" | "plan" | "work" | "risks" | "team" | "costs" | "docs" | "codex">("brief");
  const [taskTitle, setTaskTitle] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [workType, setWorkType] = useState<WorkItemKind>("pbi");
  const [workParentId, setWorkParentId] = useState("");
  const [riskTitle, setRiskTitle] = useState("");
  const [riskSeverity, setRiskSeverity] = useState("medium");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const assignmentOptions = useMemo(() => [...new Set([
    ...workspaceMembers
      .filter((member) => String(member.status || "active") !== "removed")
      .map((member) => String(member.displayName || member.email || member.emailLower || "").trim())
      .filter(Boolean),
    ...tasks.map((item) => String(item.owner || item.assignee || "").trim()).filter(Boolean),
  ])].sort(), [tasks, workspaceMembers]);
  const methodology = String(project.methodology || "scrum").toLowerCase();
  const currentHealth = projectHealth(project, tasks, risks);
  const openTasks = tasks.filter((task) => taskWorkLane(task) !== "done");
  const openMilestones = milestones.filter((item) => String(item.status || "").toLowerCase() !== "completed");
  const blockedTasks = tasks.filter((task) => taskWorkLane(task) === "blocked");
  const lanes = useMemo(() => ({
    backlog: tasks.filter((task) => taskWorkLane(task) === "backlog"),
    in_progress: tasks.filter((task) => taskWorkLane(task) === "in_progress"),
    blocked: blockedTasks,
    done: tasks.filter((task) => taskWorkLane(task) === "done"),
  }), [blockedTasks, tasks]);
  const hierarchy = useMemo(() => {
    const epics = sortWorkItems(tasks.filter((task) => workItemKind(task) === "epic"));
    const features = sortWorkItems(tasks.filter((task) => workItemKind(task) === "feature"));
    const pbis = sortWorkItems(tasks.filter((task) => ["pbi", "story", "task", "bug"].includes(workItemKind(task))));
    const subtasks = sortWorkItems(tasks.filter((task) => workItemKind(task) === "subtask"));
    return { epics, features, pbis, subtasks };
  }, [tasks]);
  const activeMembers = workspaceMembers.filter((member) => String(member.status || "active") !== "removed");
  const roleOptions = activeMembers.map((member) => ({ id: member.id, name: memberName(member) }));

  useEffect(() => {
    setTab("brief");
    setArchiveConfirm(false);
    setDeleteConfirm(false);
  }, [project.id]);

  const update = (patch: ProjectPatch) => onUpdateProject(project.id, patch);
  const consoleCostRows = costRows(project);
  const consoleCostSummary = projectSummary(project, tasks);
  const consolePlannedCost = consoleCostRows.reduce((sum: number, row: any) => sum + rowCost(row), 0);
  const consoleActualCost = consoleCostRows.reduce((sum: number, row: any) => sum + rowCost(row, true), 0);
  const consoleCostVariance = consoleActualCost - consolePlannedCost;
  const updateConsoleCostRow = (index: number, patch: ProjectPatch) => update({ costBreakdown: consoleCostRows.map((row: any, rowIndex: number) => rowIndex === index ? { ...row, ...patch } : row) });
  const addConsoleCostRow = () => update({ costBreakdown: [...consoleCostRows, { dimension: "New cost driver", category: "development", unit: "hour", cadence: "initial", plannedQty: 0, actualQty: 0, rate: 0 }] });
  const removeConsoleCostRow = (index: number) => update({ costBreakdown: consoleCostRows.filter((_: any, rowIndex: number) => rowIndex !== index) });
  const submitTask = async () => {
    if (!taskTitle.trim()) return;
    await onAddTask(taskTitle.trim(), "backlog");
    setTaskTitle("");
  };
  const submitWorkItem = async () => {
    if (!workTitle.trim()) return;
    const parent = tasks.find((item) => item.id === workParentId);
    const parentKind = parent ? workItemKind(parent) : null;
    const patch: ProjectPatch = {
      workItemType: workType,
      itemType: workType,
      taskType: workType,
      parentId: workParentId || null,
      epicId: parentKind === "epic" ? workParentId : parent?.epicId || null,
      featureId: parentKind === "feature" ? workParentId : parent?.featureId || null,
      priority: null,
      order: tasks.length,
      rank: tasks.length,
    };
    await onAddTask(workTitle.trim(), "backlog", patch);
    setWorkTitle("");
  };
  const moveWorkItem = async (items: any[], item: any, direction: -1 | 1) => {
    const ordered = sortWorkItems(items);
    const index = ordered.findIndex((candidate) => candidate.id === item.id);
    const other = ordered[index + direction];
    if (!other) return;
    const currentOrder = itemOrder(item, index);
    const otherOrder = itemOrder(other, index + direction);
    await onUpdateTask(item.id, { order: otherOrder, rank: otherOrder });
    await onUpdateTask(other.id, { order: currentOrder, rank: currentOrder });
  };
  const datedEpics = hierarchy.epics
    .filter((epic) => taskWorkLane(epic) !== "done")
    .sort((left, right) => String(left.dueDate || left.targetDate || "9999-12-31").localeCompare(String(right.dueDate || right.targetDate || "9999-12-31")));
  const nextMilestone = datedEpics[0] || openMilestones[0] || openTasks
    .filter((item) => item.dueDate || item.targetDate)
    .sort((left, right) => String(left.dueDate || left.targetDate).localeCompare(String(right.dueDate || right.targetDate)))[0];
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const nextRisk = [...risks]
    .filter((risk) => !["closed", "resolved", "accepted"].includes(String(risk.status || "open").toLowerCase()))
    .sort((left, right) => (severityOrder[String(left.severity || "medium").toLowerCase()] ?? 2) - (severityOrder[String(right.severity || "medium").toLowerCase()] ?? 2))[0] || blockedTasks[0];
  const parentOptions = workType === "epic"
    ? []
    : workType === "feature"
      ? hierarchy.epics
      : workType === "subtask"
        ? hierarchy.pbis
        : [...hierarchy.features, ...hierarchy.epics];
  const tabHelp: Partial<Record<typeof tab, string>> = {
    backlog: "Hierarchy and prioritization: Epic → Feature → PBI → Subtask.",
    work: "Execution board. Use it to move active items through Backlog, Doing, Blocked and Done.",
    team: "Project governance roles and the people allowed to own delivery work.",
    costs: "Planned and actual hours, initial investment, recurring costs and unit-based cost drivers.",
    risks: "Risk register, severity and the signals used to calculate project health.",
  };
  const renderWorkItemRow = (item: any, peers: any[]) => {
    const kind = workItemKind(item);
    return (
      <article className={`do-backlog-row is-${kind}`} key={item.id}>
        <div className="do-backlog-rank">
          <button aria-label={`Move ${projectTitle(item)} up`} onClick={() => moveWorkItem(peers, item, -1)} type="button"><ArrowUp size={12} /></button>
          <button aria-label={`Move ${projectTitle(item)} down`} onClick={() => moveWorkItem(peers, item, 1)} type="button"><ArrowDown size={12} /></button>
        </div>
        <div className="do-backlog-title">
          <span>{item.key ? `${workItemLabel(kind)} · ${item.key}` : workItemLabel(kind)}</span>
          <InlineEdit ariaLabel={`Title for ${projectTitle(item)}`} onCommit={(title) => title && onUpdateTask(item.id, { title })} placeholder="Untitled work item" value={item.title || item.name} />
        </div>
        <select aria-label={`Status for ${projectTitle(item)}`} onChange={(event) => onUpdateTask(item.id, { status: event.target.value })} value={canonicalWorkStatus(item)}>
          <option value="backlog">Backlog</option>
          <option value="ready">Ready</option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="in_review">In review</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select aria-label={`Priority for ${projectTitle(item)}`} onChange={(event) => onUpdateTask(item.id, { priority: event.target.value === "N/A" ? null : event.target.value })} value={priorityValue(item.priority)}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="N/A">N/A</option>
        </select>
        <MultiAssigneePicker members={workspaceMembers} onChange={(assigneeIds, assignees) => onUpdateTask(item.id, { assigneeIds, assignees, owner: assignees[0] || "", assignee: assignees[0] || "" })} selectedIds={Array.isArray(item.assigneeIds) ? item.assigneeIds : []} selectedNames={Array.isArray(item.assignees) ? item.assignees : [item.owner || item.assignee].filter(Boolean)} />
        <input aria-label={`Due date for ${projectTitle(item)}`} defaultValue={dateInputValue(item.dueDate || item.targetDate)} onBlur={(event) => onUpdateTask(item.id, { dueDate: event.target.value || null })} type="date" />
      </article>
    );
  };
  const renderExecutableWithSubtasks = (item: any, peers: any[]) => {
    const children = hierarchy.subtasks.filter((subtask) => workItemParentId(subtask) === item.id);
    return (
      <div className="do-backlog-executable" key={item.id}>
        {renderWorkItemRow(item, peers)}
        {children.length > 0 && <div className="do-backlog-subtasks">{children.map((subtask) => renderWorkItemRow(subtask, children))}</div>}
      </div>
    );
  };

  return (
    <section className="do-project-console" data-testid="project-console">
      <datalist id="do-project-member-options">
        {assignmentOptions.map((owner) => <option key={owner} value={owner} />)}
      </datalist>
      <div className="do-console-hero">
        <div>
          <span className="do-project-card-kicker">PROJECT CONSOLE</span>
          <InlineEdit ariaLabel="Project name" onCommit={(title) => title && update({ title, name: title })} placeholder="Project name" value={projectTitle(project)} />
          <p>{project.outcome || project.objective || project.description || "Define the outcome so every conversation and work item points to the same finish line."}</p>
        </div>
        <button aria-label={isProjectFavorite(project) ? "Remove from favorites" : "Add to favorites"} className={isProjectFavorite(project) ? "is-favorite" : ""} onClick={() => update({ favorite: !isProjectFavorite(project) })} type="button"><Star fill={isProjectFavorite(project) ? "currentColor" : "none"} size={15} /></button>
      </div>

      <div className="do-console-metrics">
        <div><strong>{openTasks.length}</strong><span>Open <InfoTip label="Open work" text="All PBIs, tasks, bugs and subtasks that are not completed or cancelled." /></span></div>
        <div><strong>{hierarchy.epics.filter((epic) => taskWorkLane(epic) !== "done").length}</strong><span>Open Epics <InfoTip label="Epics" text="The major outcomes that automatically act as delivery checkpoints." /></span></div>
        <div className={blockedTasks.length || risks.length ? "is-risk" : ""}><strong>{blockedTasks.length + risks.length}</strong><span>Signals <InfoTip label="Risk signals" text="Open risks plus blocked work items. Severity determines their effect on project health." /></span></div>
        <div className={healthClass(currentHealth)}><strong>{projectHealthLabel(currentHealth)}</strong><span>Health <InfoTip label="Project health" text="Calculated from blocked work, risk severity, overdue delivery dates and any manual override." /></span></div>
      </div>

      <div className="do-console-controls">
        <ProjectStatusSelect onUpdate={update} project={project} />
        <label className="do-inline-control"><span>Stage <InfoTip label="Delivery stage" text="Define clarifies the project; Onboarding aligns client and team; Build creates it; Deploy releases it; Operations runs and supports it." /></span><select aria-label="Project delivery stage" onChange={(event) => update({ deliveryStage: event.target.value })} value={deliveryStage(project)}>{DELIVERY_STAGES.map((stage) => <option key={stage} value={stage}>{deliveryStageLabels[stage]}</option>)}</select></label>
        <select aria-label="Project method" onChange={(event) => update({ methodology: event.target.value })} value={methodology}>
          <option value="scrum">Scrum</option>
          <option value="pmi">PMI</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <button onClick={() => onAsk(`Give me the cleanest project update for ${projectTitle(project)}: decision, progress, risk, next action.`)} type="button"><MessageSquare size={13} /> Ask</button>
      </div>

      <nav className="do-console-tabs" aria-label="Project console sections">
        {([
          ["brief", "Brief"], ["backlog", "Backlog"], ["plan", "Plan"], ["work", "Board"], ["team", "Team"], ["costs", "Costs"], ["risks", "Risks"], ["docs", "Docs"], ["codex", "Codex"],
        ] as const).map(([value, label]) => (
          <button className={tab === value ? "is-active" : ""} key={value} onClick={() => setTab(value)} type="button"><span>{label}</span>{tabHelp[value] && <InfoTip label={label} text={tabHelp[value] || ""} />}</button>
        ))}
      </nav>

      {tab === "brief" && (
        <div className="do-console-section">
          <EditableField label="Outcome" multiline onCommit={(outcome) => update({ outcome })} placeholder="What will be observably true when this project is done?" value={project.outcome || project.objective} />
          <div className="do-console-insights">
            <article><span>Next delivery point <InfoTip label="Next delivery point" text="Automatically uses the nearest open Epic due date, then falls back to a legacy milestone or dated item." /></span><strong>{nextMilestone?.title || nextMilestone?.name || "No dated Epic yet"}</strong><small>{nextMilestone?.dueDate || nextMilestone?.targetDate || "Add a due date to the next Epic in Backlog."}</small><button onClick={() => setTab("backlog")} type="button">{nextMilestone ? "Open backlog" : "Create or date an Epic"}</button></article>
            <article><span>Main risk <InfoTip label="Main risk" text="Automatically selects the highest-severity open risk; blocked work is used when no risk is recorded." /></span><strong>{nextRisk?.title || nextRisk?.description || "No active risk recorded"}</strong><small>{nextRisk ? `${String(nextRisk.severity || "medium").toUpperCase()} · ${nextRisk.mitigation || nextRisk.response || nextRisk.assignee || "Response needs definition"}` : "Add a risk with severity and response."}</small><button onClick={() => setTab("risks")} type="button">{nextRisk ? "Open risk register" : "Add a risk"}</button></article>
          </div>
          <div className="do-console-ask-grid">
            <button onClick={() => onAsk(`Create the next coherent implementation batch for ${projectTitle(project)} with owners, dependencies, acceptance evidence, and requirement IDs.`)} type="button"><Sparkles size={13} /> Build next batch</button>
            <button onClick={() => onAsk(`Prepare a team planning agenda for ${projectTitle(project)} using ${methodology.toUpperCase()} with decisions, roles, milestones, risks, and next actions.`)} type="button"><Users size={13} /> Team planning</button>
          </div>
        </div>
      )}

      {tab === "backlog" && (
        <div className="do-console-section">
          <section className="do-planning-session">
            <div>
              <span className="do-project-card-kicker">PLANNING SESSION</span>
              <h4>{methodology === "pmi" ? "Scope planning" : "Sprint planning"}</h4>
            </div>
            <InlineEdit ariaLabel="Planning session name" onCommit={(planningSessionName) => update({ planningSessionName })} placeholder="Session name" value={project.planningSessionName || project.currentSprintName || ""} />
            <input aria-label="Planning start date" defaultValue={dateInputValue(project.sprintStartDate || project.planningStartDate)} onBlur={(event) => update({ sprintStartDate: event.target.value || null })} type="date" />
            <input aria-label="Planning end date" defaultValue={dateInputValue(project.sprintEndDate || project.planningEndDate)} onBlur={(event) => update({ sprintEndDate: event.target.value || null })} type="date" />
            <button onClick={() => onAsk(`Run a planning session for ${projectTitle(project)}. Use the current epics, features, PBIs, priorities, owners, risks, and dates. Help me decide the sprint or phase commitment.`)} type="button"><Sparkles size={13} /> Plan session</button>
          </section>

          <section className="do-backlog-add">
            <select aria-label="Work item type" onChange={(event) => { setWorkType(event.target.value as WorkItemKind); setWorkParentId(""); }} value={workType}>
              <option value="epic">Epic</option>
              <option value="feature">Feature</option>
              <option value="pbi">PBI</option>
              <option value="story">Story</option>
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="subtask">Subtask</option>
            </select>
            <select aria-label="Parent work item" disabled={parentOptions.length === 0} onChange={(event) => setWorkParentId(event.target.value)} value={workParentId}>
              <option value="">{workType === "epic" ? "No parent" : workType === "feature" ? "Choose epic" : workType === "subtask" ? "Choose executable parent" : "Choose feature or epic"}</option>
              {parentOptions.map((item) => <option key={item.id} value={item.id}>{workItemLabel(workItemKind(item))} · {projectTitle(item)}</option>)}
            </select>
            <input onChange={(event) => setWorkTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitWorkItem()} placeholder={`Add ${workItemLabel(workType)}...`} value={workTitle} />
            <button disabled={!workTitle.trim()} onClick={submitWorkItem} type="button"><Plus size={13} /> Add</button>
          </section>

          <div className="do-backlog-summary">
            <span><strong>{hierarchy.epics.length}</strong> Epics</span>
            <span><strong>{hierarchy.features.length}</strong> Features</span>
            <span><strong>{hierarchy.pbis.length}</strong> Executable</span>
            <span><strong>{hierarchy.subtasks.length}</strong> Subtasks</span>
          </div>

          <div className="do-backlog-tree">
            {hierarchy.epics.map((epic) => {
              const epicFeatures = hierarchy.features.filter((feature) => workItemParentId(feature) === epic.id || feature.epicId === epic.id);
              const epicPbis = hierarchy.pbis.filter((pbi) => (pbi.parentId === epic.id || pbi.epicId === epic.id) && !pbi.featureId);
              return (
                <section className="do-backlog-epic" key={epic.id}>
                  {renderWorkItemRow(epic, hierarchy.epics)}
                  <div className="do-backlog-children">
                    {epicFeatures.map((feature) => {
                      const featurePbis = hierarchy.pbis.filter((pbi) => pbi.parentId === feature.id || pbi.featureId === feature.id);
                      return (
                        <div className="do-backlog-feature" key={feature.id}>
                          {renderWorkItemRow(feature, epicFeatures)}
                          <div className="do-backlog-children is-pbis">
                            {featurePbis.map((pbi) => renderExecutableWithSubtasks(pbi, featurePbis))}
                          </div>
                        </div>
                      );
                    })}
                    {epicPbis.map((pbi) => renderExecutableWithSubtasks(pbi, epicPbis))}
                  </div>
                </section>
              );
            })}

            {hierarchy.features.filter((feature) => !workItemParentId(feature)).map((feature) => {
              const featurePbis = hierarchy.pbis.filter((pbi) => pbi.parentId === feature.id || pbi.featureId === feature.id);
              return (
                <section className="do-backlog-epic is-unassigned" key={feature.id}>
                  {renderWorkItemRow(feature, hierarchy.features.filter((item) => !workItemParentId(item)))}
                  <div className="do-backlog-children is-pbis">
                    {featurePbis.map((pbi) => renderExecutableWithSubtasks(pbi, featurePbis))}
                  </div>
                </section>
              );
            })}

            {hierarchy.pbis.filter((pbi) => !workItemParentId(pbi)).length > 0 && (
              <section className="do-backlog-epic is-unassigned">
                <header><strong>Unassigned PBIs</strong><span>{hierarchy.pbis.filter((pbi) => !workItemParentId(pbi)).length}</span></header>
                {hierarchy.pbis.filter((pbi) => !workItemParentId(pbi)).map((pbi) => renderExecutableWithSubtasks(pbi, hierarchy.pbis.filter((item) => !workItemParentId(item))))}
              </section>
            )}

            {hierarchy.subtasks.filter((subtask) => !hierarchy.pbis.some((item) => item.id === workItemParentId(subtask))).length > 0 && (
              <section className="do-backlog-epic is-unassigned">
                <header><strong>Unassigned subtasks</strong><span>{hierarchy.subtasks.filter((subtask) => !hierarchy.pbis.some((item) => item.id === workItemParentId(subtask))).length}</span></header>
                {hierarchy.subtasks.filter((subtask) => !hierarchy.pbis.some((item) => item.id === workItemParentId(subtask))).map((subtask) => renderWorkItemRow(subtask, hierarchy.subtasks))}
              </section>
            )}

            {tasks.length === 0 && <EmptyState icon={<ListChecks size={18} />} title="No backlog yet" text="Create epics, features, and PBIs here, or ask Certo Work to extract them from the PRD." />}
          </div>
        </div>
      )}

      {tab === "plan" && (
        <div className="do-console-section">
          <EditableField label={methodology === "pmi" ? "Delivery governance" : "Sprint goal"} multiline onCommit={(sprintGoal) => update({ sprintGoal })} placeholder={methodology === "pmi" ? "Scope, approvals, controls, and closeout criteria." : "What should this sprint prove or deliver?"} value={project.sprintGoal || project.deliveryGovernance} />
          <div className="do-section-title"><div><span className="do-project-card-kicker">AUTO-GENERATED CHECKPOINTS</span><h4>Epic delivery plan</h4></div><InfoTip label="Epic checkpoints" text="Every open Epic becomes a delivery checkpoint. Add its owner and due date in Backlog; the Brief updates automatically." /></div>
          <div className="do-console-list">
            {hierarchy.epics.map((epic) => <article key={epic.id}><Flag size={13} /><span><strong>{epic.title || epic.name}</strong><small>{epic.dueDate || epic.targetDate || "No due date"} · {canonicalWorkStatus(epic)}</small></span><button onClick={() => setTab("backlog")} type="button">Edit</button></article>)}
            {hierarchy.epics.length === 0 && <EmptyState icon={<Flag size={18} />} title="No Epics yet" text="Create the first Epic in Backlog; it will automatically appear here as a delivery checkpoint." />}
          </div>
          {milestones.length > 0 && <details className="do-legacy-milestones"><summary>{milestones.length} legacy milestone{milestones.length === 1 ? "" : "s"}</summary><div>{milestones.map((milestone) => <span key={milestone.id}>{milestone.title || milestone.name}</span>)}</div></details>}
        </div>
      )}

      {tab === "work" && (
        <div className="do-console-section">
          <div className="do-project-inline-add do-console-add"><input onChange={(event) => setTaskTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitTask()} placeholder="Add work item..." value={taskTitle} /><button disabled={!taskTitle.trim()} onClick={submitTask} type="button"><Plus size={13} /> Add</button></div>
          <div className="do-console-board">
            {([
              ["backlog", "Backlog"], ["in_progress", "Doing"], ["blocked", "Blocked"], ["done", "Done"],
            ] as const).map(([lane, label]) => (
              <section key={lane}>
                <header><span>{label}</span><small>{lanes[lane].length}</small></header>
                {lanes[lane].slice(0, 8).map((task) => <article key={task.id}><strong>{task.title || task.name}</strong><select aria-label={`Move ${task.title || "task"}`} onChange={(event) => onUpdateTask(task.id, { status: event.target.value })} value={lane}><option value="backlog">Backlog</option><option value="in_progress">Doing</option><option value="blocked">Blocked</option><option value="done">Done</option></select></article>)}
                {lanes[lane].length === 0 && <p>No work here</p>}
              </section>
            ))}
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className="do-console-section">
          <div className="do-section-title"><div><span className="do-project-card-kicker">PROJECT GOVERNANCE</span><h4>Accountability and delivery team</h4></div><InfoTip label="Project roles" text="The Project Manager owns delivery, the Product Owner owns value and backlog decisions, and Sponsors provide authority, funding and escalation support." /></div>
          <div className="do-project-role-grid">
            <label><span>Project Manager <InfoTip label="Project Manager" text="Owns delivery plan, coordination, dependencies, status and escalation." /></span><select onChange={(event) => update({ projectManagerId: event.target.value || null, projectManager: roleOptions.find((option) => option.id === event.target.value)?.name || "" })} value={project.projectManagerId || ""}><option value="">Unassigned</option>{roleOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <label><span>Product Owner <InfoTip label="Product Owner" text="Owns desired outcomes, backlog priority and acceptance decisions." /></span><select onChange={(event) => update({ productOwnerId: event.target.value || null, productOwner: roleOptions.find((option) => option.id === event.target.value)?.name || "" })} value={project.productOwnerId || ""}><option value="">Unassigned</option>{roleOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <label><span>Delivery / Tech Lead <InfoTip label="Delivery lead" text="Owns technical execution, engineering quality and implementation readiness." /></span><select onChange={(event) => update({ deliveryLeadId: event.target.value || null, deliveryLead: roleOptions.find((option) => option.id === event.target.value)?.name || "" })} value={project.deliveryLeadId || ""}><option value="">Unassigned</option>{roleOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <label><span>Client Lead <InfoTip label="Client lead" text="Primary client-side owner for decisions, access and acceptance." /></span><select onChange={(event) => update({ clientLeadId: event.target.value || null, clientLead: roleOptions.find((option) => option.id === event.target.value)?.name || "" })} value={project.clientLeadId || ""}><option value="">Unassigned</option>{roleOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          </div>
          <div className="do-project-team-pickers">
            <section><span>Sponsors <InfoTip label="Sponsors" text="One or more executives who provide mandate, funding and escalation decisions." /></span><MultiAssigneePicker label="Sponsors" members={workspaceMembers} onChange={(sponsorIds, sponsors) => update({ sponsorIds, sponsors, sponsor: sponsors[0] || "" })} selectedIds={Array.isArray(project.sponsorIds) ? project.sponsorIds : []} selectedNames={Array.isArray(project.sponsors) ? project.sponsors : [project.sponsor].filter(Boolean)} /></section>
            <section><span>Project team <InfoTip label="Project team" text="People who may be assigned to Epics, Features, PBIs, tasks, bugs or subtasks." /></span><MultiAssigneePicker label="Project team" members={workspaceMembers} onChange={(teamMemberIds, teamMembers) => update({ teamMemberIds, teamMembers })} selectedIds={Array.isArray(project.teamMemberIds) ? project.teamMemberIds : []} selectedNames={Array.isArray(project.teamMembers) ? project.teamMembers : []} /></section>
          </div>
        </div>
      )}

      {tab === "costs" && (
        <div className="do-console-section">
          <div className="do-section-title"><div><span className="do-project-card-kicker">PROJECT ECONOMICS</span><h4>Hours, investment and recurring cost</h4></div><InfoTip label="Project costs" text="Track planned versus actual quantities for development, implementation, support and usage-based vendors. Rate × quantity calculates cost." /></div>
          <div className="do-cost-summary-grid">
            <div><span>Development & support hours</span><strong>{consoleCostSummary.actualHours}h / {consoleCostSummary.plannedHours}h</strong><small>Actual / planned</small></div>
            <div><span>Labor cost</span><strong>${consoleCostSummary.actualLabor.toLocaleString()} / ${consoleCostSummary.plannedLabor.toLocaleString()}</strong><small>Actual / planned</small></div>
            <label><span>Initial investment <InfoTip label="Initial investment" text="One-time setup, discovery, development and implementation cost." /></span><input defaultValue={consoleCostSummary.initial || ""} onBlur={(event) => update({ initialCost: Number(event.target.value || 0) })} type="number" /></label>
            <label><span>Monthly recurring <InfoTip label="Recurring cost" text="Expected monthly operating, support, license and usage cost." /></span><input defaultValue={consoleCostSummary.recurring || ""} onBlur={(event) => update({ recurringMonthlyCost: Number(event.target.value || 0) })} type="number" /></label>
          </div>
          <div className="do-console-cost-table">
            <div className="do-console-cost-head"><span>Cost driver</span><span>Category</span><span>Cadence</span><span>Unit</span><span>Planned</span><span>Actual</span><span>Rate</span><span>Planned cost</span><span>Actual cost</span><span /></div>
            {consoleCostRows.map((row: any, index: number) => <div className="do-console-cost-row" key={`${row.dimension}-${index}`}><input defaultValue={row.dimension} onBlur={(event) => updateConsoleCostRow(index, { dimension: event.target.value.trim() || "Cost driver" })} /><select onChange={(event) => updateConsoleCostRow(index, { category: event.target.value })} value={row.category || "development"}><option value="development">Development</option><option value="implementation">Implementation</option><option value="support">Support</option><option value="vendor">Vendor</option><option value="license">License</option><option value="infrastructure">Infrastructure</option><option value="other">Other</option></select><select onChange={(event) => updateConsoleCostRow(index, { cadence: event.target.value })} value={row.cadence || "initial"}><option value="initial">Initial</option><option value="recurring">Recurring</option><option value="usage">Usage</option></select><select onChange={(event) => updateConsoleCostRow(index, { unit: event.target.value })} value={row.unit || "hour"}>{COST_UNITS.map((unit) => <option key={unit} value={unit}>{costUnitLabels[unit]}</option>)}</select><input defaultValue={row.plannedQty || 0} onBlur={(event) => updateConsoleCostRow(index, { plannedQty: Number(event.target.value || 0) })} type="number" /><input defaultValue={row.actualQty || 0} onBlur={(event) => updateConsoleCostRow(index, { actualQty: Number(event.target.value || 0) })} type="number" /><input defaultValue={row.rate || 0} onBlur={(event) => updateConsoleCostRow(index, { rate: Number(event.target.value || 0) })} type="number" /><strong>${rowCost(row).toLocaleString()}</strong><strong>${rowCost(row, true).toLocaleString()}</strong><button aria-label={`Remove ${row.dimension}`} onClick={() => removeConsoleCostRow(index)} type="button"><X size={12} /></button></div>)}
          </div>
          <div className="do-cost-audit-summary"><div><span>Total planned</span><strong>${consolePlannedCost.toLocaleString()}</strong></div><div><span>Total actual</span><strong>${consoleActualCost.toLocaleString()}</strong></div><div className={consoleCostVariance > 0 ? "is-over" : ""}><span>Variance</span><strong>{consoleCostVariance > 0 ? "+" : ""}${consoleCostVariance.toLocaleString()}</strong></div><div><span>Audit coverage</span><strong>{consoleCostRows.length} driver{consoleCostRows.length === 1 ? "" : "s"}</strong></div><InfoTip label="Cost audit" text="Variance compares actual quantity × rate with planned quantity × rate across every cost driver. Positive variance means the project is over the current plan." /></div>
          <button className="do-add-cost-row" onClick={addConsoleCostRow} type="button"><Plus size={13} /> Add cost driver</button>
        </div>
      )}

      {tab === "risks" && (
        <div className="do-console-section">
          <div className="do-health-explainer"><div><span className="do-project-card-kicker">PROJECT HEALTH</span><h4>{projectHealthLabel(currentHealth)}</h4><p>Auto health checks blocked items, open risk severity and overdue project dates. Use a manual override only when the delivery lead has evidence the automatic signal is wrong.</p></div><label><span>Mode <InfoTip label="Health mode" text="Auto is recommended. A manual override stays in effect until you return this field to Auto." /></span><select aria-label="Project health mode" onChange={(event) => update({ healthOverride: event.target.value === "auto" ? null : event.target.value })} value={project.healthOverride || "auto"}><option value="auto">Auto · {projectHealthLabel(currentHealth)}</option>{PROJECT_HEALTH.map((health) => <option key={health} value={health}>Override · {projectHealthLabel(health)}</option>)}</select></label></div>
          <div className="do-console-list">
            {risks.map((risk) => <article key={risk.id}><AlertTriangle size={13} /><span><strong>{risk.title || risk.description}</strong><small>{String(risk.severity || "medium").toUpperCase()} · {risk.response || risk.mitigation || risk.owner || "Response needs definition"}</small></span></article>)}
            {blockedTasks.map((task) => <article key={`task-${task.id}`}><Circle size={13} /><span><strong>{task.title}</strong><small>Blocked work item · {task.assignee || "Unassigned"}</small></span></article>)}
            {risks.length === 0 && blockedTasks.length === 0 && <EmptyState icon={<CheckCircle2 size={18} />} title="No open risks" text="Add risks early, while they are still manageable." />}
          </div>
          <div className="do-project-inline-add do-risk-add"><select aria-label="New risk severity" onChange={(event) => setRiskSeverity(event.target.value)} value={riskSeverity}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select><input onChange={(event) => setRiskTitle(event.target.value)} onKeyDown={async (event) => { if (event.key === "Enter" && riskTitle.trim()) { await onAddRisk(riskTitle.trim(), { severity: riskSeverity }); setRiskTitle(""); } }} placeholder="Add risk or assumption..." value={riskTitle} /><button disabled={!riskTitle.trim()} onClick={async () => { await onAddRisk(riskTitle.trim(), { severity: riskSeverity }); setRiskTitle(""); }} type="button"><Plus size={13} /> Add</button></div>
        </div>
      )}

      {tab === "docs" && (
        <div className="do-console-section">
          <div className="do-console-list">
            {documents.map((document) => {
              const content = String(document.content || document.body || document.description || "");
              return <article key={document.id}><FileText size={13} /><span><strong>{document.title || document.name || "Untitled document"}</strong><small>{document.summary || content.slice(0, 120) || "No summary recorded."}</small></span><button onClick={() => onAsk(`Using ${document.title || "this project document"}, tell me what ${projectTitle(project)} should do next.`)} type="button"><ArrowRight size={12} /></button></article>;
            })}
            {documents.length === 0 && <EmptyState icon={<FileText size={18} />} title="No docs yet" text="Paste a PRD in this project conversation and ask Certo Work to save it here." />}
          </div>
        </div>
      )}

      {tab === "codex" && (
        <CodexBridgePanel
          conversationId={conversationId}
          documents={documents}
          project={project}
          tasks={tasks}
        />
      )}

      <div className="do-console-danger">
        {String(project.status || "").toLowerCase() === "deleted" && onRestoreProject ? <button onClick={() => onRestoreProject(project)} type="button">Restore project</button> : <>
          {archiveConfirm ? <><button onClick={() => setArchiveConfirm(false)} type="button">Cancel</button><button onClick={() => onArchiveProject(project)} type="button">Confirm archive</button></> : <button onClick={() => setArchiveConfirm(true)} type="button"><Archive size={13} /> Archive</button>}
          {onDeleteProject && (deleteConfirm ? <><button onClick={() => setDeleteConfirm(false)} type="button">Cancel</button><button onClick={() => onDeleteProject(project)} type="button">Move to deleted</button></> : <button onClick={() => setDeleteConfirm(true)} type="button"><X size={13} /> Delete · restore for 30 days</button>)}
        </>}
      </div>
    </section>
  );
}

const DELIVERY_STAGES = ["define", "onboarding", "build", "deploy", "operations"] as const;
type DeliveryStage = (typeof DELIVERY_STAGES)[number];
type PortfolioView = "dashboard" | "overview" | "economics";
type ProjectSortKey = "project" | "bpo_client" | "stage" | "phase_status" | "health" | "progress" | "due" | "next_step" | "hours" | "economics";
type PortfolioDimension = "bpo" | "client" | "stage" | "status" | "health" | "service" | "owner";

const projectSortOptions: Array<{ value: ProjectSortKey; label: string }> = [
  { value: "project", label: "Project / taxonomy" },
  { value: "bpo_client", label: "BPO / client" },
  { value: "stage", label: "Stage" },
  { value: "phase_status", label: "Phase / status" },
  { value: "health", label: "Health" },
  { value: "progress", label: "Progress" },
  { value: "due", label: "Due" },
  { value: "next_step", label: "Next step" },
  { value: "hours", label: "Hours" },
  { value: "economics", label: "Economics" },
];

const portfolioDimensionOptions: Array<{ value: PortfolioDimension; label: string }> = [
  { value: "bpo", label: "BPO" },
  { value: "client", label: "Client" },
  { value: "stage", label: "Delivery stage" },
  { value: "status", label: "Status" },
  { value: "health", label: "Health" },
  { value: "service", label: "Service" },
  { value: "owner", label: "Accountable owner" },
];

const COST_UNITS = ["hour", "ai_minute", "transaction", "hit", "mb", "fee", "license", "other"] as const;
const costUnitLabels: Record<string, string> = {
  hour: "Hour",
  ai_minute: "AI voice minute",
  transaction: "Transaction",
  hit: "Hit / request",
  mb: "MB",
  fee: "Fee",
  license: "License",
  other: "Other",
};

const COST_TEMPLATES = [
  {
    id: "ai-voice-retell",
    name: "AI voice + delivery",
    description: "Development, implementation, support and voice minutes from a provider such as Retell.",
    rows: [
      { dimension: "Development", unit: "hour", plannedQty: 120, actualQty: 0, rate: 95 },
      { dimension: "Implementation", unit: "hour", plannedQty: 48, actualQty: 0, rate: 85 },
      { dimension: "Support", unit: "hour", plannedQty: 24, actualQty: 0, rate: 75 },
      { dimension: "Retell voice", unit: "ai_minute", plannedQty: 4000, actualQty: 0, rate: 0.07 },
      { dimension: "Platform fee", unit: "fee", plannedQty: 1, actualQty: 0, rate: 250 },
    ],
  },
  {
    id: "usage-based-platform",
    name: "Usage-based platform",
    description: "Mix of hours, transactions, hits and data transfer.",
    rows: [
      { dimension: "Development", unit: "hour", plannedQty: 80, actualQty: 0, rate: 95 },
      { dimension: "Transactions", unit: "transaction", plannedQty: 10000, actualQty: 0, rate: 0.03 },
      { dimension: "API calls", unit: "hit", plannedQty: 250000, actualQty: 0, rate: 0.002 },
      { dimension: "Data transfer", unit: "mb", plannedQty: 50000, actualQty: 0, rate: 0.01 },
      { dimension: "Support", unit: "hour", plannedQty: 18, actualQty: 0, rate: 75 },
    ],
  },
  {
    id: "managed-operations",
    name: "Managed operations",
    description: "Recurring support with implementation and fixed fees.",
    rows: [
      { dimension: "Implementation", unit: "hour", plannedQty: 36, actualQty: 0, rate: 85 },
      { dimension: "Support", unit: "hour", plannedQty: 60, actualQty: 0, rate: 75 },
      { dimension: "Monitoring fee", unit: "fee", plannedQty: 1, actualQty: 0, rate: 600 },
      { dimension: "License", unit: "license", plannedQty: 1, actualQty: 0, rate: 300 },
    ],
  },
];

const deliveryStageLabels: Record<DeliveryStage, string> = {
  define: "Define",
  onboarding: "Onboarding",
  build: "Build",
  deploy: "Deploy",
  operations: "Operations",
};

function deliveryStage(project: any): DeliveryStage {
  const value = String(project?.deliveryStage || project?.phase || project?.status || "build").toLowerCase().replace(/[^a-z]/g, "");
  if (value.includes("define") || value.includes("idea") || value.includes("diseno") || value.includes("propuesta") || value.includes("hold")) return "define";
  if (value.includes("onboard")) return "onboarding";
  if (value.includes("deploy") || value.includes("preproduction") || value.includes("qa")) return "deploy";
  if (value.includes("operat") || value.includes("prod")) return "operations";
  return "build";
}

function moneyValue(value: any) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function inferredCostCategory(row: any) {
  const value = String(row?.dimension || "").toLowerCase();
  if (value.includes("support")) return "support";
  if (value.includes("implement")) return "implementation";
  if (value.includes("develop")) return "development";
  if (value.includes("license")) return "license";
  if (["ai_minute", "transaction", "hit", "mb"].includes(String(row?.unit || ""))) return "vendor";
  return "other";
}

function inferredCostCadence(row: any) {
  const value = String(row?.dimension || "").toLowerCase();
  if (["ai_minute", "transaction", "hit", "mb"].includes(String(row?.unit || ""))) return "usage";
  if (value.includes("support") || value.includes("license") || value.includes("monitor")) return "recurring";
  return "initial";
}

function costRows(project: any) {
  const rows = Array.isArray(project?.costBreakdown) ? project.costBreakdown : [];
  if (rows.length) return rows.map((row: any) => ({
    ...row,
    category: row.category || inferredCostCategory(row),
    cadence: row.cadence || inferredCostCadence(row),
    unit: row.unit || "hour",
    plannedQty: Number(row.plannedQty ?? row.plannedHours ?? 0),
    actualQty: Number(row.actualQty ?? row.actualHours ?? 0),
    rate: Number(row.rate || row.unitRate || 0),
  }));
  return [
    { dimension: "Development", category: "development", cadence: "initial", unit: "hour", plannedQty: Number(project?.developmentHoursPlanned || 0), actualQty: Number(project?.developmentHoursSpent || 0), rate: Number(project?.developmentHourlyRate || 0) },
    { dimension: "Implementation", category: "implementation", cadence: "initial", unit: "hour", plannedQty: Number(project?.implementationHoursPlanned || 0), actualQty: Number(project?.implementationHoursSpent || 0), rate: Number(project?.implementationHourlyRate || 0) },
    { dimension: "Support", category: "support", cadence: "recurring", unit: "hour", plannedQty: Number(project?.supportHoursPlanned || 0), actualQty: Number(project?.supportHoursSpent || 0), rate: Number(project?.supportHourlyRate || 0) },
  ];
}

function rowCost(row: any, actual = false) {
  return Number(actual ? row?.actualQty ?? row?.actualHours ?? 0 : row?.plannedQty ?? row?.plannedHours ?? 0) * Number(row?.rate || 0);
}

function rowHours(row: any, actual = false) {
  if (String(row?.unit || "hour") !== "hour") return 0;
  return Number(actual ? row?.actualQty ?? row?.actualHours ?? 0 : row?.plannedQty ?? row?.plannedHours ?? 0);
}

function projectProgress(project: any, projectTasks: any[]) {
  if (Number.isFinite(Number(project?.progress))) return Number(project.progress);
  const done = projectTasks.filter((task) => taskWorkLane(task) === "done").length;
  return projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;
}

function projectSummary(project: any, projectTasks: any[]) {
  const rows = costRows(project);
  const plannedHours = rows.reduce((sum: number, row: any) => sum + rowHours(row), 0);
  const actualHours = rows.reduce((sum: number, row: any) => sum + rowHours(row, true), 0);
  const plannedLabor = rows.reduce((sum: number, row: any) => sum + rowCost(row), 0);
  const actualLabor = rows.reduce((sum: number, row: any) => sum + rowCost(row, true), 0);
  const rowInitial = rows.filter((row: any) => String(row.cadence || "initial") === "initial").reduce((sum: number, row: any) => sum + rowCost(row), 0);
  const rowRecurring = rows.filter((row: any) => ["recurring", "usage"].includes(String(row.cadence || ""))).reduce((sum: number, row: any) => sum + rowCost(row), 0);
  const explicitInitial = moneyValue(project.initialCost || project.costInitial || project.setupCost);
  const explicitRecurring = moneyValue(project.recurringMonthlyCost || project.monthlyRecurringCost || project.recurringCost);
  return {
    plannedHours,
    actualHours,
    plannedLabor,
    actualLabor,
    initial: explicitInitial || rowInitial,
    recurring: explicitRecurring || rowRecurring,
    openItems: Number.isFinite(Number(project.openItems)) ? Number(project.openItems) : projectTasks.filter((task) => taskWorkLane(task) !== "done").length,
    progress: projectProgress(project, projectTasks),
  };
}

function projectDueDate(project: any) {
  return String(project?.revisedDueDate || project?.dueDate || project?.targetDate || project?.originalDueDate || "").slice(0, 10) || "No date";
}

function projectSortValue(project: any, key: ProjectSortKey, tasks: any[], risks: any[]) {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const summary = projectSummary(project, projectTasks);
  if (key === "bpo_client") return `${project.bpo || ""}|${project.client || ""}`.toLowerCase();
  if (key === "stage") return String(DELIVERY_STAGES.indexOf(deliveryStage(project))).padStart(2, "0");
  if (key === "phase_status") return `${project.phase || ""}|${project.sourceStatus || project.status || ""}`.toLowerCase();
  if (key === "health") return String({ blocked: 0, at_risk: 1, on_track: 2 }[projectHealth(project, projectTasks, risks.filter((risk) => risk.projectId === project.id))] ?? 3);
  if (key === "progress") return String(1000 - summary.progress).padStart(4, "0");
  if (key === "due") return projectDueDate(project) === "No date" ? "9999-12-31" : projectDueDate(project);
  if (key === "next_step") return String(project.nextAction || "zzzz").toLowerCase();
  if (key === "hours") return String(1_000_000 - summary.plannedHours).padStart(8, "0");
  if (key === "economics") return String(1_000_000_000 - summary.initial - summary.recurring * 12).padStart(12, "0");
  return `${projectTitle(project)}|${project.projectKey || ""}`.toLowerCase();
}

function portfolioDimensionValue(project: any, dimension: PortfolioDimension, tasks: any[], risks: any[]) {
  if (dimension === "bpo") return String(project.bpo || "Internal").trim() || "Internal";
  if (dimension === "client") return String(project.client || "Internal").trim() || "Internal";
  if (dimension === "stage") return deliveryStageLabels[deliveryStage(project)];
  if (dimension === "status") return projectStatusLabel(String(project.status || "planning"));
  if (dimension === "health") return projectHealthLabel(projectHealth(project, tasks.filter((task) => task.projectId === project.id), risks.filter((risk) => risk.projectId === project.id)));
  if (dimension === "service") return String(project.serviceLine || project.technology || project.projectType || project.category || "Unclassified").trim() || "Unclassified";
  return String(project.projectManager || project.owner || project.productOwner || "Unassigned").trim() || "Unassigned";
}

function escapeHtml(value: any) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
}

export function ProjectCommandCenter({ projects, tasks, risks, costTemplates = [], onClose, onAsk, onUpdateProject, onArchiveProject, onDeleteProject, onRestoreProject, onOpenProject, onCreateCostTemplate, onUpdateCostTemplate }: {
  projects: any[];
  tasks: any[];
  risks: any[];
  costTemplates?: any[];
  onClose: () => void;
  onAsk?: (prompt: string) => void;
  onCreateCostTemplate?: (template: any) => Promise<void> | void;
  onUpdateCostTemplate?: (templateId: string, patch: Record<string, unknown>) => Promise<void> | void;
} & SharedProjectActions) {
  const [filter, setFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState<"all" | DeliveryStage>("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [taxonomyDimension, setTaxonomyDimension] = useState<PortfolioDimension>("bpo");
  const [taxonomyValue, setTaxonomyValue] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<PortfolioView>("dashboard");
  const [primarySort, setPrimarySort] = useState<ProjectSortKey>("stage");
  const [secondarySort, setSecondarySort] = useState<ProjectSortKey>("due");
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const sorted = sortProjectsByRecency(projects);
  const portfolio = sorted;
  const templates = [...COST_TEMPLATES, ...costTemplates.filter((template) => !COST_TEMPLATES.some((builtin) => builtin.id === template.id))];
  const realProjects = sorted;
  const filtered = portfolio.filter((project) => {
    const status = String(project.status || "planning").toLowerCase();
    const health = projectHealth(project, tasks.filter((task) => task.projectId === project.id), risks.filter((risk) => risk.projectId === project.id));
    const matchesFilter = filter === "all" || (filter === "active" ? !["completed", "archived", "done", "deleted", "cancelled"].includes(status) : status === filter);
    const matchesStage = stageFilter === "all" || deliveryStage(project) === stageFilter;
    const matchesHealth = healthFilter === "all" || health === healthFilter;
    const matchesTaxonomy = !taxonomyValue || portfolioDimensionValue(project, taxonomyDimension, tasks, risks) === taxonomyValue;
    const haystack = `${projectTitle(project)} ${project.client || ""} ${project.serviceLine || ""} ${project.projectKey || ""}`.toLowerCase();
    return matchesFilter && matchesStage && matchesHealth && matchesTaxonomy && haystack.includes(search.toLowerCase());
  });
  const sortedFiltered = [...filtered].sort((left, right) => {
    const primary = projectSortValue(left, primarySort, tasks, risks).localeCompare(projectSortValue(right, primarySort, tasks, risks));
    if (primary) return primary;
    if (primarySort !== secondarySort) {
      const secondary = projectSortValue(left, secondarySort, tasks, risks).localeCompare(projectSortValue(right, secondarySort, tasks, risks));
      if (secondary) return secondary;
    }
    return projectTitle(left).localeCompare(projectTitle(right));
  });
  const openProjects = portfolio.filter((project) => !["completed", "archived", "done", "deleted", "cancelled"].includes(String(project.status || "").toLowerCase()));
  const allAttention = openProjects.filter((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectRisks = risks.filter((risk) => risk.projectId === project.id);
    return projectHealth(project, projectTasks, projectRisks) !== "on_track";
  });
  const attention = allAttention.slice(0, 3);
  const allRows = realProjects.map((project) => projectSummary(project, tasks.filter((task) => task.projectId === project.id)));
  const totals = allRows.reduce((acc, row) => ({
    plannedHours: acc.plannedHours + Number(row.plannedHours || 0),
    actualHours: acc.actualHours + Number(row.actualHours || 0),
    initial: acc.initial + row.initial,
    recurring: acc.recurring + row.recurring,
  }), { plannedHours: 0, actualHours: 0, initial: 0, recurring: 0 });
  const stageCounts = DELIVERY_STAGES.map((stage) => ({ stage, count: realProjects.filter((project) => deliveryStage(project) === stage).length }));
  const healthCounts = (["on_track", "at_risk", "blocked"] as const).map((health) => ({ health, count: realProjects.filter((project) => projectHealth(project, tasks.filter((task) => task.projectId === project.id), risks.filter((risk) => risk.projectId === project.id)) === health).length }));
  const upcomingProjects = [...realProjects].sort((left, right) => {
    const leftDate = projectDueDate(left);
    const rightDate = projectDueDate(right);
    if (leftDate === "No date") return 1;
    if (rightDate === "No date") return -1;
    return leftDate.localeCompare(rightDate);
  }).slice(0, 8);
  const taxonomyBreakdown = [...new Set(realProjects.map((project) => portfolioDimensionValue(project, taxonomyDimension, tasks, risks)))]
    .map((value) => ({ value, count: realProjects.filter((project) => portfolioDimensionValue(project, taxonomyDimension, tasks, risks) === value).length }))
    .sort((left, right) => right.count - left.count);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const updateCostRow = (project: any, index: number, patch: Record<string, unknown>) => {
    const rows = costRows(project).map((row: any, rowIndex: number) => rowIndex === index ? { ...row, ...patch } : row);
    onUpdateProject(project.id, { costBreakdown: rows });
  };

  const saveTemplate = async (project: any) => {
    if (!templateName.trim() || !onCreateCostTemplate) return;
    await onCreateCostTemplate({
      name: templateName.trim(),
      description: `Custom template based on ${projectTitle(project)}.`,
      rows: costRows(project),
    });
    setTemplateName("");
  };

  const saveTemplateChanges = async (project: any) => {
    const template = templates.find((item) => item.id === project.costTemplateId);
    if (!template || COST_TEMPLATES.some((item) => item.id === template.id) || !onUpdateCostTemplate) return;
    await onUpdateCostTemplate(template.id, { rows: costRows(project) });
  };

  const renderEconomics = (project: any, projectTasks: any[]) => {
    const summary = projectSummary(project, projectTasks);
    const rows = costRows(project);
    return <div className="do-command-economics" key={`${project.id}-economics`}>
      <div className="do-command-economics-head"><div><span className="do-project-card-kicker">ECONOMICS & CAPACITY</span><strong>{projectTitle(project)}</strong><small>{project.client || "Internal"} · {project.serviceLine || "Delivery"} · {summary.actualHours}h used of {summary.plannedHours}h planned</small></div><div className="do-command-economics-total"><span>Initial</span><strong>${summary.initial.toLocaleString()}</strong><span>Monthly recurring</span><strong>${summary.recurring.toLocaleString()}</strong></div></div>
      <div className="do-cost-grid"><label>Delivery stage<select onChange={(event) => onUpdateProject(project.id, { deliveryStage: event.target.value })} value={deliveryStage(project)}>{DELIVERY_STAGES.map((stage) => <option key={stage} value={stage}>{deliveryStageLabels[stage]}</option>)}</select></label><label>Next step<input defaultValue={project.nextAction || ""} onBlur={(event) => onUpdateProject(project.id, { nextAction: event.target.value.trim() })} placeholder="Next concrete step" /></label><label>Initial cost<input defaultValue={summary.initial || ""} onBlur={(event) => onUpdateProject(project.id, { initialCost: Number(event.target.value || 0) })} type="number" /></label><label>Monthly recurring<input defaultValue={summary.recurring || ""} onBlur={(event) => onUpdateProject(project.id, { recurringMonthlyCost: Number(event.target.value || 0) })} type="number" /></label></div>
      <div className="do-cost-template-bar"><label>Template<select onChange={(event) => { const template = templates.find((item) => item.id === event.target.value); if (template) onUpdateProject(project.id, { costTemplateId: template.id, costBreakdown: template.rows }); }} value={project.costTemplateId || "custom"}><option value="custom">Custom / editable</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><span>{project.costTemplateId ? templates.find((template) => template.id === project.costTemplateId)?.description : "Choose a reusable cost model, then edit any line for this project."}</span><div className="do-cost-template-actions"><input aria-label="New cost template name" onChange={(event) => setTemplateName(event.target.value)} placeholder="New template name" value={templateName} /><button disabled={!templateName.trim() || !onCreateCostTemplate} onClick={() => saveTemplate(project)} type="button">Save as template</button>{project.costTemplateId && !COST_TEMPLATES.some((item) => item.id === project.costTemplateId) && <button disabled={!onUpdateCostTemplate} onClick={() => saveTemplateChanges(project)} type="button">Update template</button>}</div></div>
      <div className="do-cost-table"><div className="do-cost-table-head"><span>Dimension</span><span>Unit</span><span>Planned qty</span><span>Actual qty</span><span>Rate</span><span>Planned cost</span><span>Actual cost</span></div>{rows.map((row: any, index: number) => <div className="do-cost-row" key={`${project.id}-${row.dimension}-${index}`}><input onBlur={(event) => updateCostRow(project, index, { dimension: event.target.value })} defaultValue={row.dimension} /><select onChange={(event) => updateCostRow(project, index, { unit: event.target.value })} value={row.unit || "hour"}>{COST_UNITS.map((unit) => <option key={unit} value={unit}>{costUnitLabels[unit]}</option>)}</select><input onBlur={(event) => updateCostRow(project, index, { plannedQty: Number(event.target.value || 0) })} defaultValue={row.plannedQty || 0} type="number" /><input onBlur={(event) => updateCostRow(project, index, { actualQty: Number(event.target.value || 0) })} defaultValue={row.actualQty || 0} type="number" /><input onBlur={(event) => updateCostRow(project, index, { rate: Number(event.target.value || 0) })} defaultValue={row.rate || 0} type="number" /><strong>${rowCost(row).toLocaleString()}</strong><strong>${rowCost(row, true).toLocaleString()}</strong></div>)}</div>
      <div className="do-cost-note"><span>Variance</span><strong className={summary.actualLabor > summary.plannedLabor ? "is-negative" : ""}>${(summary.actualLabor - summary.plannedLabor).toLocaleString()}</strong><small>Labor cost is calculated from actual hours × rate. Add one row per team, service or phase when a project needs a deeper breakdown.</small></div>
    </div>;
  };

  const exportPortfolioPdf = () => {
    const printable = window.open("", "_blank", "width=1200,height=800");
    if (!printable) return;
    const rows = sortedFiltered.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const health = projectHealth(project, projectTasks, risks.filter((risk) => risk.projectId === project.id));
      const summary = projectSummary(project, projectTasks);
      return `<tr><td><strong>${escapeHtml(projectTitle(project))}</strong><small>${escapeHtml(project.projectKey || "")}</small></td><td>${escapeHtml(project.bpo || "Internal")}<small>${escapeHtml(project.client || "Internal")}</small></td><td>${escapeHtml(deliveryStageLabels[deliveryStage(project)])}</td><td>${escapeHtml(project.phase || "—")}<small>${escapeHtml(project.sourceStatus || project.status || "—")}</small></td><td><span class="health ${escapeHtml(health)}">${escapeHtml(projectHealthLabel(health))}</span></td><td>${summary.progress}%</td><td>${escapeHtml(projectDueDate(project))}</td><td>${escapeHtml(project.nextAction || "Define next step")}</td><td>${summary.actualHours}h / ${summary.plannedHours}h</td><td>$${summary.initial.toLocaleString()}<small>$${summary.recurring.toLocaleString()} / month</small></td></tr>`;
    }).join("");
    printable.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Certo Work · ${escapeHtml(filter === "all" ? "Portfolio" : projectStatusLabel(filter))}</title><style>@page{size:A3 landscape;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#25372d;font:12px Inter,Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #244f3a}h1{margin:4px 0;font-size:28px;letter-spacing:-1px}.kicker{color:#52735f;font-size:10px;font-weight:800;letter-spacing:1.4px}.meta{text-align:right;color:#718078}table{width:100%;border-collapse:collapse;table-layout:fixed}th{padding:9px 7px;border-bottom:1px solid #bbc9bf;color:#6d7b72;font-size:9px;text-align:left;text-transform:uppercase}td{padding:10px 7px;border-bottom:1px solid #e1e7e2;vertical-align:top;word-wrap:break-word}td:first-child{width:16%}td:nth-child(8){width:17%}strong,small{display:block}small{margin-top:3px;color:#859188;font-size:9px}.health{display:inline-block;border-radius:999px;background:#e6f0e9;padding:4px 7px;color:#356b4c;font-weight:700}.health.at_risk{background:#f5ecd9;color:#98651f}.health.blocked{background:#f4e1dd;color:#a24e40}footer{margin-top:15px;color:#829088;font-size:9px}</style></head><body><header><div><div class="kicker">CERTO WORK · PROJECT PORTFOLIO</div><h1>${escapeHtml(filter === "all" ? "All projects" : projectStatusLabel(filter))}</h1><div>${sortedFiltered.length} projects · sorted by ${escapeHtml(projectSortOptions.find((option) => option.value === primarySort)?.label)} then ${escapeHtml(projectSortOptions.find((option) => option.value === secondarySort)?.label)}</div></div><div class="meta">Generated ${escapeHtml(new Date().toLocaleString())}<br/>Current filtered view</div></header><table><thead><tr><th>Project</th><th>BPO / Client</th><th>Stage</th><th>Phase / Status</th><th>Health</th><th>Progress</th><th>Due</th><th>Next step</th><th>Hours</th><th>Economics</th></tr></thead><tbody>${rows}</tbody></table><footer>Health reflects the current Certo Work signals and any manual override. Use the browser print dialog to save this report as PDF.</footer><script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`);
    printable.document.close();
  };

  return (
    <section aria-label="Project command center" className="do-command-center do-command-center-embedded" data-testid="project-command-center">
        <header className="do-command-head"><div><span className="do-project-card-kicker">DELIVERY CONTROL TOWER</span><h1>Project command center</h1><p>Review by exception, understand the portfolio, then open a project only when detail is needed.</p></div><div className="do-command-head-actions"><button className={view === "dashboard" ? "is-active" : ""} onClick={() => setView("dashboard")} type="button"><LayoutGrid size={14} /> Dashboard</button><button aria-label="Close command center" onClick={onClose} type="button"><X size={19} /></button></div></header>
        <div className="do-command-metrics"><div><strong>{realProjects.filter((project) => !["completed", "archived", "done", "deleted", "cancelled"].includes(String(project.status || "").toLowerCase())).length} / {realProjects.length}</strong><span>Open / total projects</span></div><div><strong>{realProjects.filter((project) => deliveryStage(project) === "operations").length}</strong><span>In operations</span></div><div className="is-risk"><strong>{realProjects.filter((project) => projectHealth(project, tasks.filter((task) => task.projectId === project.id), risks.filter((risk) => risk.projectId === project.id)) !== "on_track").length}</strong><span>Need attention</span></div><div><strong>{Math.round(totals.actualHours)}h / {Math.round(totals.plannedHours)}h</strong><span>Hours used / planned</span></div><div><strong>${Math.round(totals.recurring).toLocaleString()}</strong><span>Monthly recurring</span></div><div><strong>${Math.round(totals.initial).toLocaleString()}</strong><span>Initial investment</span></div></div>
        <div className={`do-command-body do-command-body-${view}`}>
          {view === "dashboard" && <section className="do-portfolio-dashboard">
            {onAsk && <section className="do-pm-copilot"><div><span><Sparkles size={13} /> CERTO FOR PROJECT MANAGERS</span><strong>Ask from the live portfolio</strong><small>Answers use the same projects, risks, dates, assignments and costs you see here.</small></div><div>{[
              "What needs my attention today, and why?",
              "Which projects are likely to miss their date?",
              "Where are we over budget or over hours?",
              "Prepare a concise stakeholder portfolio update.",
            ].map((question) => <button key={question} onClick={() => onAsk(question)} type="button">{question}<ArrowRight size={12} /></button>)}</div></section>}
            <div className="do-portfolio-dashboard-grid">
              <section className="do-portfolio-card"><div className="do-portfolio-card-head"><div><span className="do-project-card-kicker">DELIVERY PIPELINE</span><h3>Projects by stage</h3></div><span>{realProjects.length} total</span></div><div className="do-stage-bars">{stageCounts.map(({ stage, count }) => <button key={stage} onClick={() => { setFilter("all"); setStageFilter(stage); setHealthFilter("all"); setTaxonomyValue(null); setSearch(""); setView("overview"); }} type="button"><span>{deliveryStageLabels[stage]}</span><i><em style={{ width: `${realProjects.length ? Math.max(4, (count / realProjects.length) * 100) : 0}%` }} /></i><strong>{count}</strong></button>)}</div></section>
              <section className="do-portfolio-card"><div className="do-portfolio-card-head"><div><span className="do-project-card-kicker">PORTFOLIO HEALTH</span><h3>Where attention is needed</h3></div><AlertTriangle size={15} /></div><div className="do-health-summary">{healthCounts.map(({ health, count }) => <button key={health} onClick={() => { setFilter("all"); setStageFilter("all"); setHealthFilter(health); setTaxonomyValue(null); setSearch(""); setView("overview"); }} type="button"><span className={`do-health-dot ${healthClass(health)}`} /><strong>{count}</strong><small>{projectHealthLabel(health)}</small></button>)}</div><p className="do-portfolio-note">Health is calculated from overdue dates, blocked work, open risks and any explicit override.</p></section>
              <section className="do-portfolio-card do-portfolio-card-wide"><div className="do-portfolio-card-head"><div><span className="do-project-card-kicker">NEXT EXITS</span><h3>Upcoming project checkpoints</h3></div><button onClick={() => setView("overview")} type="button">Open portfolio <ArrowRight size={13} /></button></div><div className="do-upcoming-list">{upcomingProjects.map((project) => { const health = projectHealth(project, tasks.filter((task) => task.projectId === project.id), risks.filter((risk) => risk.projectId === project.id)); return <button key={project.id} onClick={() => onOpenProject(project)} type="button"><span className={`do-health-dot ${healthClass(health)}`} /><span><strong>{projectTitle(project)}</strong><small>{project.client || "Internal"} · {project.phase || deliveryStageLabels[deliveryStage(project)]}</small></span><time>{projectDueDate(project)}</time><ArrowRight size={13} /></button>; })}{upcomingProjects.length === 0 && <EmptyState icon={<CalendarDays size={18} />} title="No dates yet" text="Add a due date from the project console." />}</div></section>
              <section className="do-portfolio-card"><div className="do-portfolio-card-head"><div><span className="do-project-card-kicker">PORTFOLIO BREAKDOWN</span><h3>Explore the portfolio</h3></div><label className="do-taxonomy-dimension"><span>Group by</span><select aria-label="Group portfolio projects" onChange={(event) => { setTaxonomyDimension(event.target.value as PortfolioDimension); setTaxonomyValue(null); }} value={taxonomyDimension}>{portfolioDimensionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><div className="do-bpo-list">{taxonomyBreakdown.slice(0, 10).map(({ value, count }) => <button className={taxonomyValue === value ? "is-active" : ""} key={value} onClick={() => { setFilter("all"); setStageFilter("all"); setHealthFilter("all"); setSearch(""); setTaxonomyValue(value); setView("overview"); }} type="button"><span>{value}</span><strong>{count}</strong></button>)}</div></section>
            </div>
          </section>}
          <section className="do-command-attention"><div className="do-command-section-head"><div><span className="do-project-card-kicker">MOST IMPORTANT NOW</span><h2>Topics requiring judgment</h2></div><AlertTriangle size={16} /></div>{attention.length ? <div>{attention.map((project) => { const health = projectHealth(project, tasks.filter((task) => task.projectId === project.id), risks.filter((risk) => risk.projectId === project.id)); return <button key={project.id} onClick={() => onOpenProject(project)} type="button"><span className={healthClass(health)}>{projectHealthLabel(health)}</span><strong>{projectTitle(project)}</strong><small>{tasks.filter((task) => task.projectId === project.id && taskWorkLane(task) === "blocked").length} blocked · {risks.filter((risk) => risk.projectId === project.id).length} risks</small><ArrowRight size={13} /></button>; })}</div> : <div className="do-command-calm"><CheckCircle2 size={17} /><span><strong>No project demands escalation.</strong><small>Review by exception; keep the team moving.</small></span></div>}</section>
          <section className="do-command-portfolio"><div className="do-command-toolbar"><div className="do-command-toolbar-left"><div className="do-command-filters">{["active", "planning", "paused", "completed", "archived", "deleted", "all"].map((value) => <button className={filter === value ? "is-active" : ""} key={value} onClick={() => setFilter(value)} type="button">{value === "all" ? "All" : value === "active" ? "Open" : projectStatusLabel(value)}</button>)}</div><div className="do-command-view-toggle"><button className={view === "overview" ? "is-active" : ""} onClick={() => setView("overview")} type="button">Portfolio</button><button className={view === "economics" ? "is-active" : ""} onClick={() => setView("economics")} type="button">Hours & costs</button></div></div><label><Search size={14} /><input aria-label="Search projects" onChange={(event) => setSearch(event.target.value)} placeholder="Search project, client or service" value={search} /></label></div><div className="do-command-subtoolbar"><label>Stage<select aria-label="Filter by delivery stage" onChange={(event) => setStageFilter(event.target.value as "all" | DeliveryStage)} value={stageFilter}><option value="all">All stages</option>{DELIVERY_STAGES.map((stage) => <option key={stage} value={stage}>{deliveryStageLabels[stage]}</option>)}</select></label><label>Health<select aria-label="Filter by project health" onChange={(event) => setHealthFilter(event.target.value)} value={healthFilter}><option value="all">All health</option><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="blocked">Blocked</option></select></label><label>Sort<select aria-label="Primary project sort" onChange={(event) => setPrimarySort(event.target.value as ProjectSortKey)} value={primarySort}>{projectSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Then<select aria-label="Secondary project sort" onChange={(event) => setSecondarySort(event.target.value as ProjectSortKey)} value={secondarySort}>{projectSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button onClick={exportPortfolioPdf} type="button"><FileText size={12} /> Export PDF</button><span className="do-command-taxonomy-note">{taxonomyValue ? <button className="do-active-filter" onClick={() => setTaxonomyValue(null)} type="button">{portfolioDimensionOptions.find((option) => option.value === taxonomyDimension)?.label}: {taxonomyValue} <X size={11} /></button> : <>Two-level sort · current filter exports to PDF <InfoTip label="Portfolio controls" text="Filter the portfolio, choose a primary and secondary sort, then export exactly that view as a print-ready PDF." /></>}</span></div>
            {view === "overview" ? <div className="do-command-table"><div className="do-command-table-head"><span>Project / taxonomy <InfoTip label="Project / taxonomy" text="Editable project identity and its stable reference key or service taxonomy." /></span><span>BPO / client <InfoTip label="BPO / client" text="The delivery organization and the client receiving the outcome." /></span><span>Stage <InfoTip label="Stage" text="Define, Onboarding, Build, Deploy or Operations. Change it directly in each row." /></span><span>Phase / status <InfoTip label="Phase / status" text="The source phase and operational record status from the project data." /></span><span>Health <InfoTip label="Health" text="Calculated from blocked items, risk severity, overdue dates and manual override." /></span><span>Progress <InfoTip label="Progress" text="Completed executable work as a percentage of all executable project items." /></span><span>Due <InfoTip label="Due date" text="Revised delivery date when available; otherwise the target or original date." /></span><span>Next step <InfoTip label="Next step" text="The single concrete action that should move the project forward next." /></span><span>Hours <InfoTip label="Hours" text="Actual versus planned development, implementation and support hours." /></span><span>Economics <InfoTip label="Economics" text="Initial investment and expected monthly recurring cost." /></span><span /></div>{sortedFiltered.map((project) => { const projectTasks = tasks.filter((task) => task.projectId === project.id); const projectRisks = risks.filter((risk) => risk.projectId === project.id); const health = projectHealth(project, projectTasks, projectRisks); const summary = projectSummary(project, projectTasks); const favorite = isProjectFavorite(project); return <div className={`do-command-project-block ${project.demo ? "is-demo" : ""}`} key={project.id}><article><div className="do-command-project-name"><button aria-label={favorite ? "Remove favorite" : "Favorite project"} className={favorite ? "is-favorite" : ""} disabled={Boolean(project.demo)} onClick={() => onUpdateProject(project.id, { favorite: !favorite })} type="button"><Star fill={favorite ? "currentColor" : "none"} size={14} /></button><span><strong>{projectTitle(project)}</strong><small>{project.demo ? "DEMO · " : ""}{project.client || "Internal"} · {project.serviceLine || project.projectType || project.category || "Delivery"}</small></span></div><span className="do-command-meta-cell"><strong>{project.bpo || "Internal"}</strong><small>{project.client || "Internal"}</small></span><select aria-label={`Stage for ${projectTitle(project)}`} className="do-stage-select" disabled={Boolean(project.demo)} onChange={(event) => onUpdateProject(project.id, { deliveryStage: event.target.value })} value={deliveryStage(project)}>{DELIVERY_STAGES.map((stage) => <option key={stage} value={stage}>{deliveryStageLabels[stage]}</option>)}</select><span className="do-command-meta-cell"><strong>{project.phase || "—"}</strong><small>{project.sourceStatus || project.status || "—"}</small></span><span className={`do-health-pill ${healthClass(health)}`}>{projectHealthLabel(health)}</span><span className="do-progress-cell"><b>{summary.progress}%</b><i><em style={{ width: `${summary.progress}%` }} /></i></span><span className="do-command-due-cell">{projectDueDate(project)}</span><span className="do-next-step">{project.nextAction || "Define next step"}</span><span>{summary.actualHours}h / {summary.plannedHours}h</span><span>${summary.initial.toLocaleString()}<small>${summary.recurring.toLocaleString()} / mo</small></span><div className="do-command-row-actions">{project.demo ? <button onClick={() => setExpandedId(expandedId === project.id ? null : project.id)} type="button">{expandedId === project.id ? "Hide" : "Preview"}</button> : ["deleted", "archived"].includes(String(project.status || "").toLowerCase()) ? <button disabled={!onRestoreProject} onClick={() => onRestoreProject?.(project)} type="button">Restore</button> : <button onClick={() => onOpenProject(project)} type="button">Open</button>}{!project.demo && !["deleted", "archived"].includes(String(project.status || "").toLowerCase()) && (archiveConfirmId === project.id ? <><button onClick={() => setArchiveConfirmId(null)} type="button">Cancel</button><button className="is-danger" onClick={() => onArchiveProject(project)} type="button">Confirm</button></> : <button aria-label={`Archive ${projectTitle(project)}`} onClick={() => setArchiveConfirmId(project.id)} type="button"><Archive size={13} /></button>)}{!project.demo && !["deleted", "archived"].includes(String(project.status || "").toLowerCase()) && onDeleteProject && <button aria-label={`Delete ${projectTitle(project)}`} onClick={() => onDeleteProject(project)} type="button"><X size={13} /></button>}</div></article>{expandedId === project.id && renderEconomics(project, projectTasks)}</div>; })}{sortedFiltered.length === 0 && <EmptyState icon={<LayoutGrid size={20} />} title="No projects in this view" text="Change the filter or create a project through the conversation." />}</div> : <div className="do-command-economics-list">{sortedFiltered.map((project) => renderEconomics(project, tasks.filter((task) => task.projectId === project.id)))}{sortedFiltered.length === 0 && <EmptyState icon={<LayoutGrid size={20} />} title="No projects in this view" text="Change the filter or create a project through the conversation." />}</div>}
          </section>
        </div>
    </section>
  );
}
