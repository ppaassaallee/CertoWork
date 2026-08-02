import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Circle,
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

export function ProjectRecordModal({
  project,
  tasks,
  milestones,
  risks,
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
  onClose: () => void;
  onAsk: (prompt: string) => void;
  onUpdateProject: SharedProjectActions["onUpdateProject"];
  onArchiveProject: SharedProjectActions["onArchiveProject"];
  onAddTask: (title: string, status: WorkLane) => Promise<void> | void;
  onUpdateTask: (taskId: string, patch: ProjectPatch) => Promise<void> | void;
  onAddMilestone: (title: string) => Promise<void> | void;
  onAddRisk: (title: string) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<"overview" | "plan" | "work" | "risks" | "team">("overview");
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
            ["overview", "Overview"], ["plan", "Plan"], ["work", "Work"], ["risks", "Risks"], ["team", "Team"],
          ] as const).map(([value, label]) => <button className={tab === value ? "is-active" : ""} key={value} onClick={() => setTab(value)} type="button">{label}{value === "risks" && risks.length > 0 ? <small>{risks.length}</small> : null}</button>)}
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
