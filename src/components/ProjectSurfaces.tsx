import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
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

type ProjectPatch = Record<string, unknown>;

type SharedProjectActions = {
  onUpdateProject: (projectId: string, patch: ProjectPatch) => Promise<void> | void;
  onArchiveProject: (project: any) => Promise<void> | void;
  onOpenProject: (project: any) => void;
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

type WorkItemKind = "epic" | "feature" | "pbi";

function workItemKind(item: any): WorkItemKind {
  const value = String(item?.workItemType || item?.itemType || item?.taskType || item?.issueType || item?.kind || "").toLowerCase();
  if (value.includes("epic")) return "epic";
  if (value.includes("feature")) return "feature";
  return "pbi";
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
    String(left.priority || "P4").localeCompare(String(right.priority || "P4")) ||
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
  if (["P1", "P2", "P3", "P4"].includes(normalized)) return normalized;
  if (["1", "HIGH", "URGENT", "CRITICAL"].includes(normalized)) return "P1";
  if (["2", "MEDIUM"].includes(normalized)) return "P2";
  if (["3", "LOW"].includes(normalized)) return "P3";
  return "P4";
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
                <div><strong>Plan this with DelivereeOS</strong><p>Use the conversation to challenge assumptions or turn this record into a credible plan.</p></div>
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
                  {documents.length === 0 && <EmptyState icon={<FileText size={19} />} title="No project documents yet" text="Paste a PRD or specification in the project conversation and ask DelivereeOS to add it here." />}
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
  onAsk: (prompt: string) => void;
  onUpdateProject: SharedProjectActions["onUpdateProject"];
  onArchiveProject: SharedProjectActions["onArchiveProject"];
  onAddTask: (title: string, status: WorkLane, patch?: ProjectPatch) => Promise<void> | void;
  onUpdateTask: (taskId: string, patch: ProjectPatch) => Promise<void> | void;
  onAddMilestone: (title: string) => Promise<void> | void;
  onAddRisk: (title: string) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<"brief" | "backlog" | "plan" | "work" | "risks" | "docs">("brief");
  const [taskTitle, setTaskTitle] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [workType, setWorkType] = useState<WorkItemKind>("pbi");
  const [workParentId, setWorkParentId] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [riskTitle, setRiskTitle] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
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
    const pbis = sortWorkItems(tasks.filter((task) => workItemKind(task) === "pbi"));
    return { epics, features, pbis };
  }, [tasks]);

  useEffect(() => {
    setTab("brief");
    setArchiveConfirm(false);
  }, [project.id]);

  const update = (patch: ProjectPatch) => onUpdateProject(project.id, patch);
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
      featureId: parentKind === "feature" ? workParentId : null,
      priority: "P3",
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
  const nextMilestone = openMilestones[0];
  const nextRisk = risks.find((risk) => String(risk.status || "open").toLowerCase() !== "closed") || blockedTasks[0];
  const parentOptions = workType === "epic"
    ? []
    : workType === "feature" ? hierarchy.epics : [...hierarchy.features, ...hierarchy.epics];
  const renderWorkItemRow = (item: any, peers: any[]) => {
    const kind = workItemKind(item);
    return (
      <article className={`do-backlog-row is-${kind}`} key={item.id}>
        <div className="do-backlog-rank">
          <button aria-label={`Move ${projectTitle(item)} up`} onClick={() => moveWorkItem(peers, item, -1)} type="button"><ArrowUp size={12} /></button>
          <button aria-label={`Move ${projectTitle(item)} down`} onClick={() => moveWorkItem(peers, item, 1)} type="button"><ArrowDown size={12} /></button>
        </div>
        <div className="do-backlog-title">
          <span>{kind === "epic" ? "Epic" : kind === "feature" ? "Feature" : "PBI"}</span>
          <InlineEdit ariaLabel={`Title for ${projectTitle(item)}`} onCommit={(title) => title && onUpdateTask(item.id, { title })} placeholder="Untitled work item" value={item.title || item.name} />
        </div>
        <select aria-label={`Status for ${projectTitle(item)}`} onChange={(event) => onUpdateTask(item.id, { status: event.target.value })} value={taskWorkLane(item)}>
          <option value="backlog">Backlog</option>
          <option value="in_progress">Doing</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>
        <select aria-label={`Priority for ${projectTitle(item)}`} onChange={(event) => onUpdateTask(item.id, { priority: event.target.value })} value={priorityValue(item.priority)}>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
          <option value="P4">P4</option>
        </select>
        <input aria-label={`Owner for ${projectTitle(item)}`} defaultValue={item.owner || item.assignee || ""} onBlur={(event) => onUpdateTask(item.id, { owner: event.target.value.trim(), assignee: event.target.value.trim() })} placeholder="Owner" />
        <input aria-label={`Due date for ${projectTitle(item)}`} defaultValue={dateInputValue(item.dueDate || item.targetDate)} onBlur={(event) => onUpdateTask(item.id, { dueDate: event.target.value || null })} type="date" />
      </article>
    );
  };

  return (
    <section className="do-project-console" data-testid="project-console">
      <div className="do-console-hero">
        <div>
          <span className="do-project-card-kicker">PROJECT CONSOLE</span>
          <h3>{projectTitle(project)}</h3>
          <p>{project.outcome || project.objective || project.description || "Define the outcome so every conversation and work item points to the same finish line."}</p>
        </div>
        <button aria-label={isProjectFavorite(project) ? "Remove from favorites" : "Add to favorites"} className={isProjectFavorite(project) ? "is-favorite" : ""} onClick={() => update({ favorite: !isProjectFavorite(project) })} type="button"><Star fill={isProjectFavorite(project) ? "currentColor" : "none"} size={15} /></button>
      </div>

      <div className="do-console-metrics">
        <div><strong>{openTasks.length}</strong><span>Open</span></div>
        <div><strong>{openMilestones.length}</strong><span>Milestones</span></div>
        <div className={blockedTasks.length || risks.length ? "is-risk" : ""}><strong>{blockedTasks.length + risks.length}</strong><span>Risks</span></div>
        <div className={healthClass(currentHealth)}><strong>{projectHealthLabel(currentHealth)}</strong><span>Health</span></div>
      </div>

      <div className="do-console-controls">
        <ProjectStatusSelect onUpdate={update} project={project} />
        <select aria-label="Project method" onChange={(event) => update({ methodology: event.target.value })} value={methodology}>
          <option value="scrum">Scrum</option>
          <option value="pmi">PMI</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <button onClick={() => onAsk(`Give me the cleanest project update for ${projectTitle(project)}: decision, progress, risk, next action.`)} type="button"><MessageSquare size={13} /> Ask</button>
      </div>

      <nav className="do-console-tabs" aria-label="Project console sections">
        {([
          ["brief", "Brief"], ["backlog", "Backlog"], ["plan", "Plan"], ["work", "Flow"], ["risks", "Risks"], ["docs", "Docs"],
        ] as const).map(([value, label]) => (
          <button className={tab === value ? "is-active" : ""} key={value} onClick={() => setTab(value)} type="button">{label}</button>
        ))}
      </nav>

      {tab === "brief" && (
        <div className="do-console-section">
          <EditableField label="Outcome" multiline onCommit={(outcome) => update({ outcome })} placeholder="What will be observably true when this project is done?" value={project.outcome || project.objective} />
          <div className="do-console-insights">
            <article><span>Next milestone</span><strong>{nextMilestone?.title || nextMilestone?.name || "No milestone set"}</strong><small>{nextMilestone?.dueDate || nextMilestone?.targetDate || "Add the next delivery point."}</small></article>
            <article><span>Main risk</span><strong>{nextRisk?.title || nextRisk?.description || "No active risk recorded"}</strong><small>{nextRisk?.mitigation || nextRisk?.response || nextRisk?.assignee || "Keep the risk register honest."}</small></article>
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
            </select>
            <select aria-label="Parent work item" disabled={parentOptions.length === 0} onChange={(event) => setWorkParentId(event.target.value)} value={workParentId}>
              <option value="">{workType === "epic" ? "No parent" : workType === "feature" ? "Choose epic" : "Choose feature or epic"}</option>
              {parentOptions.map((item) => <option key={item.id} value={item.id}>{workItemKind(item) === "epic" ? "Epic" : "Feature"} · {projectTitle(item)}</option>)}
            </select>
            <input onChange={(event) => setWorkTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitWorkItem()} placeholder={`Add ${workType === "pbi" ? "PBI" : workType}...`} value={workTitle} />
            <button disabled={!workTitle.trim()} onClick={submitWorkItem} type="button"><Plus size={13} /> Add</button>
          </section>

          <div className="do-backlog-summary">
            <span><strong>{hierarchy.epics.length}</strong> Epics</span>
            <span><strong>{hierarchy.features.length}</strong> Features</span>
            <span><strong>{hierarchy.pbis.length}</strong> PBIs</span>
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
                            {featurePbis.map((pbi) => renderWorkItemRow(pbi, featurePbis))}
                          </div>
                        </div>
                      );
                    })}
                    {epicPbis.map((pbi) => renderWorkItemRow(pbi, epicPbis))}
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
                    {featurePbis.map((pbi) => renderWorkItemRow(pbi, featurePbis))}
                  </div>
                </section>
              );
            })}

            {hierarchy.pbis.filter((pbi) => !workItemParentId(pbi)).length > 0 && (
              <section className="do-backlog-epic is-unassigned">
                <header><strong>Unassigned PBIs</strong><span>{hierarchy.pbis.filter((pbi) => !workItemParentId(pbi)).length}</span></header>
                {hierarchy.pbis.filter((pbi) => !workItemParentId(pbi)).map((pbi) => renderWorkItemRow(pbi, hierarchy.pbis.filter((item) => !workItemParentId(item))))}
              </section>
            )}

            {tasks.length === 0 && <EmptyState icon={<ListChecks size={18} />} title="No backlog yet" text="Create epics, features, and PBIs here, or ask DelivereeOS to extract them from the PRD." />}
          </div>
        </div>
      )}

      {tab === "plan" && (
        <div className="do-console-section">
          <EditableField label={methodology === "pmi" ? "Delivery governance" : "Sprint goal"} multiline onCommit={(sprintGoal) => update({ sprintGoal })} placeholder={methodology === "pmi" ? "Scope, approvals, controls, and closeout criteria." : "What should this sprint prove or deliver?"} value={project.sprintGoal || project.deliveryGovernance} />
          <div className="do-console-list">
            {milestones.map((milestone) => <article key={milestone.id}><Flag size={13} /><span><strong>{milestone.title || milestone.name}</strong><small>{milestone.dueDate || milestone.targetDate || "No date"} · {milestone.status || "not started"}</small></span></article>)}
            {milestones.length === 0 && <EmptyState icon={<Flag size={18} />} title="No milestones yet" text="Add one meaningful delivery point." />}
          </div>
          <div className="do-project-inline-add"><input onChange={(event) => setMilestoneTitle(event.target.value)} onKeyDown={async (event) => { if (event.key === "Enter" && milestoneTitle.trim()) { await onAddMilestone(milestoneTitle.trim()); setMilestoneTitle(""); } }} placeholder="Add milestone..." value={milestoneTitle} /><button disabled={!milestoneTitle.trim()} onClick={async () => { await onAddMilestone(milestoneTitle.trim()); setMilestoneTitle(""); }} type="button"><Plus size={13} /> Add</button></div>
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

      {tab === "risks" && (
        <div className="do-console-section">
          <label className="do-console-health"><span>Project health</span><select aria-label="Project health" onChange={(event) => update({ health: event.target.value })} value={currentHealth}>{PROJECT_HEALTH.map((health) => <option key={health} value={health}>{projectHealthLabel(health)}</option>)}</select></label>
          <div className="do-console-list">
            {risks.map((risk) => <article key={risk.id}><AlertTriangle size={13} /><span><strong>{risk.title || risk.description}</strong><small>{risk.response || risk.mitigation || risk.owner || "Response needs definition"}</small></span></article>)}
            {blockedTasks.map((task) => <article key={`task-${task.id}`}><Circle size={13} /><span><strong>{task.title}</strong><small>Blocked work item · {task.assignee || "Unassigned"}</small></span></article>)}
            {risks.length === 0 && blockedTasks.length === 0 && <EmptyState icon={<CheckCircle2 size={18} />} title="No open risks" text="Add risks early, while they are still manageable." />}
          </div>
          <div className="do-project-inline-add"><input onChange={(event) => setRiskTitle(event.target.value)} onKeyDown={async (event) => { if (event.key === "Enter" && riskTitle.trim()) { await onAddRisk(riskTitle.trim()); setRiskTitle(""); } }} placeholder="Add risk or assumption..." value={riskTitle} /><button disabled={!riskTitle.trim()} onClick={async () => { await onAddRisk(riskTitle.trim()); setRiskTitle(""); }} type="button"><Plus size={13} /> Add</button></div>
        </div>
      )}

      {tab === "docs" && (
        <div className="do-console-section">
          <div className="do-console-list">
            {documents.map((document) => {
              const content = String(document.content || document.body || document.description || "");
              return <article key={document.id}><FileText size={13} /><span><strong>{document.title || document.name || "Untitled document"}</strong><small>{document.summary || content.slice(0, 120) || "No summary recorded."}</small></span><button onClick={() => onAsk(`Using ${document.title || "this project document"}, tell me what ${projectTitle(project)} should do next.`)} type="button"><ArrowRight size={12} /></button></article>;
            })}
            {documents.length === 0 && <EmptyState icon={<FileText size={18} />} title="No docs yet" text="Paste a PRD in this project conversation and ask DelivereeOS to save it here." />}
          </div>
        </div>
      )}

      <div className="do-console-danger">
        {archiveConfirm ? (
          <>
            <button onClick={() => setArchiveConfirm(false)} type="button">Cancel</button>
            <button onClick={() => onArchiveProject(project)} type="button">Archive</button>
          </>
        ) : (
          <button onClick={() => setArchiveConfirm(true)} type="button"><Archive size={13} /> Archive project</button>
        )}
      </div>
    </section>
  );
}

export function ProjectCommandCenter({ projects, tasks, risks, onClose, onUpdateProject, onArchiveProject, onOpenProject }: {
  projects: any[];
  tasks: any[];
  risks: any[];
  onClose: () => void;
} & SharedProjectActions) {
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const sorted = sortProjectsByRecency(projects);
  const visible = sorted.filter((project) => {
    const status = String(project.status || "planning").toLowerCase();
    const matchesFilter = filter === "all" || (filter === "active" ? !["completed", "archived", "done"].includes(status) : status === filter);
    return matchesFilter && projectTitle(project).toLowerCase().includes(search.toLowerCase());
  });
  const openProjects = sorted.filter((project) => !["completed", "archived", "done"].includes(String(project.status || "").toLowerCase()));
  const allAttention = openProjects.filter((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectRisks = risks.filter((risk) => risk.projectId === project.id);
    return projectHealth(project, projectTasks, projectRisks) !== "on_track";
  });
  const attention = allAttention.slice(0, 3);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div aria-label="Project command center" aria-modal="true" className="do-project-layer do-command-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <section className="do-command-center" data-testid="project-command-center">
        <header className="do-command-head"><div><span className="do-project-card-kicker">PORTFOLIO CONTROL</span><h1>Project command center</h1><p>Classify, prioritize and move delivery from one quiet place.</p></div><button aria-label="Close command center" onClick={onClose} type="button"><X size={19} /></button></header>
        <div className="do-command-metrics"><div><strong>{openProjects.length}</strong><span>Open projects</span></div><div><strong>{openProjects.filter((project) => projectHealth(project, tasks.filter((task) => task.projectId === project.id), risks.filter((risk) => risk.projectId === project.id)) === "on_track").length}</strong><span>On track</span></div><div className="is-risk"><strong>{allAttention.length}</strong><span>Need attention</span></div><div><strong>{tasks.filter((task) => taskWorkLane(task) === "blocked").length}</strong><span>Blocked items</span></div></div>
        <div className="do-command-body">
          <section className="do-command-attention"><div className="do-command-section-head"><div><span className="do-project-card-kicker">MOST IMPORTANT NOW</span><h2>Topics requiring judgment</h2></div><AlertTriangle size={16} /></div>{attention.length ? <div>{attention.map((project) => { const health = projectHealth(project, tasks.filter((task) => task.projectId === project.id), risks.filter((risk) => risk.projectId === project.id)); return <button key={project.id} onClick={() => onOpenProject(project)} type="button"><span className={healthClass(health)}>{projectHealthLabel(health)}</span><strong>{projectTitle(project)}</strong><small>{tasks.filter((task) => task.projectId === project.id && taskWorkLane(task) === "blocked").length} blocked · {risks.filter((risk) => risk.projectId === project.id).length} risks</small><ArrowRight size={13} /></button>; })}</div> : <div className="do-command-calm"><CheckCircle2 size={17} /><span><strong>No project demands escalation.</strong><small>Review by exception; keep the team moving.</small></span></div>}</section>
          <section className="do-command-portfolio"><div className="do-command-toolbar"><div className="do-command-filters">{["active", "planning", "paused", "completed", "archived", "all"].map((value) => <button className={filter === value ? "is-active" : ""} key={value} onClick={() => setFilter(value)} type="button">{value === "all" ? "All" : value === "active" ? "Open" : projectStatusLabel(value)}</button>)}</div><label><Search size={14} /><input aria-label="Search projects" onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" value={search} /></label></div>
            <div className="do-command-table"><div className="do-command-table-head"><span>Project</span><span>Method</span><span>Status</span><span>Health</span><span>Work</span><span /></div>{visible.map((project) => { const projectTasks = tasks.filter((task) => task.projectId === project.id); const projectRisks = risks.filter((risk) => risk.projectId === project.id); const health = projectHealth(project, projectTasks, projectRisks); const favorite = isProjectFavorite(project); return <article key={project.id}><div className="do-command-project-name"><button aria-label={favorite ? "Remove favorite" : "Favorite project"} className={favorite ? "is-favorite" : ""} onClick={() => onUpdateProject(project.id, { favorite: !favorite })} type="button"><Star fill={favorite ? "currentColor" : "none"} size={14} /></button><span><strong>{projectTitle(project)}</strong><small>{project.projectType || project.category || "Unclassified"}</small></span></div><span>{String(project.methodology || "Scrum").toUpperCase()}</span><ProjectStatusSelect onUpdate={(patch) => onUpdateProject(project.id, patch)} project={project} /><span className={`do-health-pill ${healthClass(health)}`}>{projectHealthLabel(health)}</span><span>{projectTasks.filter((task) => taskWorkLane(task) !== "done").length} open</span><div className="do-command-row-actions"><button onClick={() => onOpenProject(project)} type="button">Open</button>{archiveConfirmId === project.id ? <><button onClick={() => setArchiveConfirmId(null)} type="button">Cancel</button><button className="is-danger" onClick={() => onArchiveProject(project)} type="button">Confirm</button></> : <button aria-label={`Archive ${projectTitle(project)}`} onClick={() => setArchiveConfirmId(project.id)} type="button"><Archive size={13} /></button>}</div></article>; })}{visible.length === 0 && <EmptyState icon={<LayoutGrid size={20} />} title="No projects in this view" text="Change the filter or create a project through the conversation." />}</div>
          </section>
        </div>
      </section>
    </div>
  );
}
