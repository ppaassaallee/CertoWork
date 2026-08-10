import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Circle,
  CalendarRange,
  Folder,
  ListChecks,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
} from "lucide-react";
import { taskWorkLane, type WorkLane } from "../lib/projectPortfolio";

type WorkItemKind = "epic" | "feature" | "pbi" | "story" | "task" | "bug" | "subtask";
type WorkItemsViewMode = "list" | "table" | "gantt";
type GroupBy = "hierarchy" | "status" | "priority" | "project" | "owner" | "type" | "due";
type SortBy = "rank" | "project" | "priority" | "due" | "title" | "status" | "owner" | "type";

type Props = {
  activeProject: any | null;
  projects: any[];
  tasks: any[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onAsk: (prompt: string) => void;
  onAddTask: (projectId: string, title: string, status: WorkLane, patch?: Record<string, unknown>) => Promise<void> | void;
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onOpenProjectConsole: (project: any) => void;
};

const workTypes: WorkItemKind[] = ["epic", "feature", "pbi", "story", "bug", "task", "subtask"];
const workStatuses = ["backlog", "ready", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"];
const priorities = ["1", "2", "3", "N/A"];
const sortOptions: Array<{ value: SortBy; label: string }> = [
  { value: "rank", label: "Manual order" },
  { value: "project", label: "Project" },
  { value: "priority", label: "Priority" },
  { value: "due", label: "Due date" },
  { value: "status", label: "Status" },
  { value: "owner", label: "Owner" },
  { value: "type", label: "Type" },
  { value: "title", label: "Title" },
];

function title(item: any) {
  return item?.title || item?.name || "Untitled";
}

function projectTitle(project: any) {
  return project?.title || project?.name || "Untitled project";
}

function itemProjectTitle(item: any, projects: any[]) {
  if (!item?.projectId) return "No project / errands";
  return projectTitle(projects.find((project) => project.id === item.projectId));
}

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
  if (kind === "pbi") return "PBI";
  if (kind === "story") return "Story PBI";
  if (kind === "bug") return "Bug PBI";
  if (kind === "task") return "Task PBI";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function parentId(item: any) {
  return String(item?.parentId || item?.featureId || item?.epicId || "");
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

function canonicalStatus(item: any) {
  const status = String(item?.status || "").toLowerCase();
  if (workStatuses.includes(status)) return status;
  return taskWorkLane(item);
}

function dueBucket(value: any) {
  const date = dateInputValue(value);
  if (!date) return "unscheduled";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${date}T00:00:00`);
  const days = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 7) return "next_7";
  if (days <= 30) return "next_30";
  return "later";
}

function itemOrder(item: any, fallback = 0) {
  const value = Number(item?.order ?? item?.rank ?? item?.position);
  return Number.isFinite(value) ? value : fallback;
}

function sortValue(item: any, sortBy: SortBy, projects: any[]) {
  if (sortBy === "project") return itemProjectTitle(item, projects).toLowerCase();
  if (sortBy === "priority") return priorityValue(item.priority) === "N/A" ? "9" : priorityValue(item.priority);
  if (sortBy === "due") return dateInputValue(item.dueDate || item.targetDate) || "9999-12-31";
  if (sortBy === "status") return canonicalStatus(item);
  if (sortBy === "owner") return String(item.owner || item.assignee || "zz unassigned").toLowerCase();
  if (sortBy === "type") return workItemKind(item);
  if (sortBy === "title") return title(item).toLowerCase();
  return String(itemOrder(item)).padStart(8, "0");
}

function sortItems(items: any[], primary: SortBy, secondary: SortBy, projects: any[]) {
  return [...items].sort((left, right) => {
    const first = sortValue(left, primary, projects).localeCompare(sortValue(right, primary, projects));
    if (first) return first;
    const second = primary === secondary ? 0 : sortValue(left, secondary, projects).localeCompare(sortValue(right, secondary, projects));
    if (second) return second;
    return title(left).localeCompare(title(right));
  });
}

function displayStatus(status: string) {
  return status === "in_progress" ? "In progress" : status === "in_review" ? "In review" : status.replace(/_/g, " ");
}

function ganttDate(item: any, fallbackDays = 0) {
  const raw = dateInputValue(item.startDate || item.plannedStartDate || item.sprintStartDate || item.dueDate || item.targetDate);
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (fallbackDays) date.setDate(date.getDate() + fallbackDays);
  return date;
}

function dateLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function InlineText({
  ariaLabel,
  value,
  onCommit,
}: {
  ariaLabel: string;
  value?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  return (
    <input
      aria-label={ariaLabel}
      onBlur={() => draft.trim() !== String(value || "").trim() && onCommit(draft.trim())}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      value={draft}
    />
  );
}

export function WorkItemsCenter({
  activeProject,
  projects,
  tasks,
  selectedItemId,
  onSelectItem,
  onAsk,
  onAddTask,
  onUpdateTask,
  onOpenProjectConsole,
}: Props) {
  const [mode, setMode] = useState<WorkItemsViewMode>("list");
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState(activeProject?.id || "all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupBy>(activeProject ? "hierarchy" : "project");
  const [primarySort, setPrimarySort] = useState<SortBy>("project");
  const [secondarySort, setSecondarySort] = useState<SortBy>("priority");
  const [newType, setNewType] = useState<WorkItemKind>("pbi");
  const [newProjectId, setNewProjectId] = useState(activeProject?.id || "");
  const [newParentId, setNewParentId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("in_progress");
  const [bulkPriority, setBulkPriority] = useState("2");
  const [bulkDueDate, setBulkDueDate] = useState("");

  useEffect(() => {
    setProjectFilter(activeProject?.id || "all");
    setNewProjectId(activeProject?.id || "");
    setGroupBy(activeProject ? "hierarchy" : "project");
    setPrimarySort("project");
    setSecondarySort("priority");
    onSelectItem(null);
  }, [activeProject?.id]);

  useEffect(() => setCollapsedGroups([]), [groupBy, primarySort, secondarySort, projectFilter, statusFilter, priorityFilter, typeFilter, ownerFilter, dateFilter, query]);

  const owners = useMemo(
    () => [...new Set(tasks.map((item) => String(item.owner || item.assignee || "").trim()).filter(Boolean))].sort(),
    [tasks],
  );
  const baseProjectId = projectFilter !== "all" && projectFilter !== "no_project" ? projectFilter : activeProject?.id || "";
  const parentOptions = useMemo(() => {
    const projectId = newProjectId || baseProjectId;
    const sameProject = tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId);
    if (newType === "epic") return [];
    if (newType === "feature") return sameProject.filter((item) => workItemKind(item) === "epic");
    if (newType === "subtask") return sameProject.filter((item) => ["pbi", "story", "task", "bug"].includes(workItemKind(item)));
    return sameProject.filter((item) => ["epic", "feature"].includes(workItemKind(item)));
  }, [baseProjectId, newProjectId, newType, tasks]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortItems(tasks.filter((item) => {
      const matchesProject = projectFilter === "all" ||
        (projectFilter === "no_project" ? !item.projectId : item.projectId === projectFilter);
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "open" ? !["done", "completed", "closed", "cancelled"].includes(String(item.status || "").toLowerCase()) : canonicalStatus(item) === statusFilter);
      const matchesPriority = priorityFilter === "all" || priorityValue(item.priority) === priorityFilter;
      const itemKind = workItemKind(item);
      const matchesType = typeFilter === "all" ||
        itemKind === typeFilter ||
        (typeFilter === "pbi" && ["pbi", "story", "task", "bug"].includes(itemKind));
      const matchesOwner = ownerFilter === "all" || String(item.owner || item.assignee || "") === ownerFilter;
      const matchesDate = dateFilter === "all" || dueBucket(item.dueDate || item.targetDate) === dateFilter;
      const searchable = `${title(item)} ${item.description || ""} ${item.key || ""} ${itemProjectTitle(item, projects)}`.toLowerCase();
      return matchesProject && matchesStatus && matchesPriority && matchesType && matchesOwner && matchesDate && (!needle || searchable.includes(needle));
    }), primarySort, secondarySort, projects);
  }, [dateFilter, ownerFilter, priorityFilter, projectFilter, projects, query, primarySort, secondarySort, statusFilter, tasks, typeFilter]);

  const selectedItem = tasks.find((item) => item.id === selectedItemId) || null;
  const currentProject = projects.find((project) => project.id === (selectedItem?.projectId || newProjectId || baseProjectId));
  const canCreate = Boolean(newTitle.trim());

  const createItem = async () => {
    const projectId = newProjectId || baseProjectId;
    if (!newTitle.trim()) return;
    const parent = tasks.find((item) => item.id === newParentId);
    const parentKind = parent ? workItemKind(parent) : null;
    await onAddTask(projectId, newTitle.trim(), "backlog", {
      workItemType: newType,
      itemType: newType,
      taskType: newType,
      parentId: newParentId || null,
      epicId: parentKind === "epic" ? newParentId : parent?.epicId || null,
      featureId: parentKind === "feature" ? newParentId : parent?.featureId || null,
      priority: null,
      order: tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId).length,
      rank: tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId).length,
    });
    setNewTitle("");
    setNewParentId("");
  };

  const moveItem = async (item: any, peers: any[], direction: -1 | 1) => {
    const ordered = sortItems(peers, "rank", "priority", projects);
    const index = ordered.findIndex((candidate) => candidate.id === item.id);
    const other = ordered[index + direction];
    if (!other) return;
    const currentOrder = itemOrder(item, index);
    const otherOrder = itemOrder(other, index + direction);
    await onUpdateTask(item.id, { order: otherOrder, rank: otherOrder });
    await onUpdateTask(other.id, { order: currentOrder, rank: currentOrder });
  };

  const updateBulk = async (patch: Record<string, unknown>) => {
    await Promise.all(selectedBulkIds.map((id) => onUpdateTask(id, patch)));
    setSelectedBulkIds([]);
  };

  const toggleBulk = (id: string) => {
    setSelectedBulkIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const renderRow = (item: any, peers: any[]) => {
    const kind = workItemKind(item);
    const children = tasks.filter((candidate) => parentId(candidate) === item.id);
    return (
      <article className={`do-items-row is-${kind} ${selectedItemId === item.id ? "is-selected" : ""}`} key={item.id}>
        <button aria-label={`Select ${title(item)}`} className="do-items-check" onClick={() => toggleBulk(item.id)} type="button">
          {selectedBulkIds.includes(item.id) ? <Check size={12} /> : <Circle size={12} />}
        </button>
        <div className="do-items-rank">
          <button aria-label={`Move ${title(item)} up`} onClick={() => moveItem(item, peers, -1)} type="button"><ArrowUp size={12} /></button>
          <button aria-label={`Move ${title(item)} down`} onClick={() => moveItem(item, peers, 1)} type="button"><ArrowDown size={12} /></button>
        </div>
        <button className="do-items-title" onClick={() => onSelectItem(item.id)} type="button">
          <span>{item.key ? `${workItemLabel(kind)} · ${item.key}` : workItemLabel(kind)}</span>
          <InlineText ariaLabel={`Title for ${title(item)}`} onCommit={(next) => next && onUpdateTask(item.id, { title: next })} value={title(item)} />
          <small>{itemProjectTitle(item, projects)}{children.length ? ` · ${children.length} child item${children.length === 1 ? "" : "s"}` : ""}{Array.isArray(item.dependencyIds) && item.dependencyIds.length ? ` · ${item.dependencyIds.length} deps` : ""}</small>
        </button>
        <select aria-label={`Status for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { status: event.target.value })} value={canonicalStatus(item)}>
          {workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}
        </select>
        <select aria-label={`Priority for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { priority: event.target.value === "N/A" ? null : event.target.value })} value={priorityValue(item.priority)}>
          {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        <input aria-label={`Owner for ${title(item)}`} defaultValue={item.owner || item.assignee || ""} onBlur={(event) => onUpdateTask(item.id, { owner: event.target.value.trim(), assignee: event.target.value.trim() })} placeholder="Owner" />
        <input aria-label={`Due date for ${title(item)}`} defaultValue={dateInputValue(item.dueDate || item.targetDate)} onBlur={(event) => onUpdateTask(item.id, { dueDate: event.target.value || null })} type="date" />
      </article>
    );
  };

  const renderHierarchy = () => {
    const epics = filtered.filter((item) => workItemKind(item) === "epic");
    const features = filtered.filter((item) => workItemKind(item) === "feature");
    const executables = filtered.filter((item) => ["pbi", "story", "task", "bug"].includes(workItemKind(item)));
    const subtasks = filtered.filter((item) => workItemKind(item) === "subtask");
    const orphanExecutables = executables.filter((item) => !parentId(item));
    return (
      <div className="do-items-tree">
        {epics.map((epic) => {
          const epicFeatures = features.filter((feature) => parentId(feature) === epic.id || feature.epicId === epic.id);
          const epicExecutables = executables.filter((item) => (parentId(item) === epic.id || item.epicId === epic.id) && !item.featureId);
          return (
            <section className="do-items-parent" key={epic.id}>
              {renderRow(epic, epics)}
              <div className="do-items-children">
                {epicFeatures.map((feature) => {
                  const featureExecutables = executables.filter((item) => parentId(item) === feature.id || item.featureId === feature.id);
                  return (
                    <div className="do-items-parent is-feature" key={feature.id}>
                      {renderRow(feature, epicFeatures)}
                      <div className="do-items-children">
                        {featureExecutables.map((item) => <div key={item.id}>{renderRow(item, featureExecutables)}<div className="do-items-subtasks">{subtasks.filter((subtask) => parentId(subtask) === item.id).map((subtask) => renderRow(subtask, subtasks))}</div></div>)}
                      </div>
                    </div>
                  );
                })}
                {epicExecutables.map((item) => <div key={item.id}>{renderRow(item, epicExecutables)}<div className="do-items-subtasks">{subtasks.filter((subtask) => parentId(subtask) === item.id).map((subtask) => renderRow(subtask, subtasks))}</div></div>)}
              </div>
            </section>
          );
        })}
        {features.filter((feature) => !parentId(feature)).map((feature) => {
          const featureExecutables = executables.filter((item) => parentId(item) === feature.id || item.featureId === feature.id);
          return (
            <section className="do-items-parent" key={feature.id}>
              {renderRow(feature, features)}
              <div className="do-items-children">{featureExecutables.map((item) => <div key={item.id}>{renderRow(item, featureExecutables)}<div className="do-items-subtasks">{subtasks.filter((subtask) => parentId(subtask) === item.id).map((subtask) => renderRow(subtask, subtasks))}</div></div>)}</div>
            </section>
          );
        })}
        {orphanExecutables.length > 0 && <section className="do-items-parent is-orphan"><header>Unassigned executable work</header>{orphanExecutables.map((item) => renderRow(item, orphanExecutables))}</section>}
        {filtered.length === 0 && <div className="do-items-empty"><ListChecks size={21} /><strong>No items here yet.</strong><span>Create the first Epic, Feature, PBI, task or bug for this context.</span></div>}
      </div>
    );
  };

  const grouped = useMemo(() => {
    const keyFor = (item: any) => {
      if (groupBy === "status") return canonicalStatus(item);
      if (groupBy === "priority") return priorityValue(item.priority);
      if (groupBy === "project") return itemProjectTitle(item, projects);
      if (groupBy === "owner") return String(item.owner || item.assignee || "Unassigned");
      if (groupBy === "type") return workItemLabel(workItemKind(item));
      if (groupBy === "due") return dueBucket(item.dueDate || item.targetDate).replace(/_/g, " ");
      return "Items";
    };
    return filtered.reduce<Record<string, any[]>>((acc, item) => {
      const key = keyFor(item);
      acc[key] = [...(acc[key] || []), item];
      return acc;
    }, {});
  }, [filtered, groupBy, projects]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((current) => current.includes(group)
      ? current.filter((item) => item !== group)
      : [...current, group]);
  };

  const renderGantt = () => {
    const dated = filtered
      .map((item) => {
        const start = ganttDate(item);
        const explicitEnd = ganttDate({ dueDate: item.dueDate || item.targetDate || item.endDate || item.plannedEndDate });
        const end = explicitEnd || (start ? ganttDate(item, 3) : null);
        return { item, start, end };
      })
      .filter((entry) => entry.start && entry.end) as Array<{ item: any; start: Date; end: Date }>;
    const undated = filtered.filter((item) => !ganttDate(item));
    const minTime = dated.length ? Math.min(...dated.map((entry) => entry.start.getTime())) : Date.now();
    const maxTime = dated.length ? Math.max(...dated.map((entry) => entry.end.getTime())) : Date.now() + 30 * 86_400_000;
    const span = Math.max(1, maxTime - minTime);
    const markers = Array.from({ length: 5 }, (_, index) => new Date(minTime + (span * index) / 4));

    return (
      <div className="do-gantt">
        <div className="do-gantt-axis">
          {markers.map((marker) => <span key={marker.toISOString()}>{dateLabel(marker)}</span>)}
        </div>
        <div className="do-gantt-rows">
          {dated.map(({ item, start, end }) => {
            const kind = workItemKind(item);
            const left = ((start.getTime() - minTime) / span) * 100;
            const width = Math.max(4, ((end.getTime() - start.getTime()) / span) * 100);
            return (
              <article className={`do-gantt-row is-${kind}`} key={item.id}>
                <button onClick={() => onSelectItem(item.id)} type="button">
                  <span>{workItemLabel(kind)}</span>
                  <strong>{title(item)}</strong>
                  <small>{itemProjectTitle(item, projects)}</small>
                </button>
                <div className="do-gantt-track">
                  <div
                    className="do-gantt-bar"
                    style={{ "--gantt-left": `${left}%`, "--gantt-width": `${Math.min(width, 100 - left)}%` } as CSSProperties}
                  >
                    <span>{dateLabel(start)} - {dateLabel(end)}</span>
                  </div>
                </div>
              </article>
            );
          })}
          {dated.length === 0 && <div className="do-items-empty"><CalendarRange size={21} /><strong>No scheduled items yet.</strong><span>Add due dates or start dates to build the project timeline.</span></div>}
        </div>
        {undated.length > 0 && (
          <section className="do-gantt-unscheduled">
            <button onClick={() => toggleGroup("gantt-unscheduled")} type="button"><ChevronDown className={collapsedGroups.includes("gantt-unscheduled") ? "is-collapsed" : ""} size={13} /><strong>No date</strong><span>{undated.length}</span></button>
            {!collapsedGroups.includes("gantt-unscheduled") && <div>{undated.slice(0, 20).map((item) => renderRow(item, undated))}</div>}
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="do-items-center" data-testid="work-items-center">
      <section className="do-items-toolbar">
        <label className="do-items-search"><Search size={14} /><input aria-label="Search work items" onChange={(event) => setQuery(event.target.value)} placeholder="Search items, requirements, keys..." value={query} /></label>
        <div className="do-items-mode" aria-label="Work item view">
          <button aria-label="List view" className={mode === "list" ? "is-active" : ""} onClick={() => setMode("list")} type="button"><ListChecks size={14} /></button>
          <button aria-label="Table view" className={mode === "table" ? "is-active" : ""} onClick={() => setMode("table")} type="button"><Table2 size={14} /></button>
          <button aria-label="Gantt view" className={mode === "gantt" ? "is-active" : ""} onClick={() => setMode("gantt")} type="button"><CalendarRange size={14} /></button>
        </div>
      </section>

      <section className="do-items-filters" aria-label="Work item filters">
        <select aria-label="Project filter" onChange={(event) => { setProjectFilter(event.target.value); setNewProjectId(event.target.value === "all" || event.target.value === "no_project" ? activeProject?.id || "" : event.target.value); }} value={projectFilter}>
          <option value="all">All projects</option>
          <option value="no_project">No project / errands</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{projectTitle(project)}</option>)}
        </select>
        <select aria-label="Status filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="open">Open</option>
          <option value="all">All statuses</option>
          {workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}
        </select>
        <select aria-label="Priority filter" onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}>
          <option value="all">Any priority</option>
          {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        <select aria-label="Type filter" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
          <option value="all">Any type</option>
          {workTypes.map((kind) => <option key={kind} value={kind}>{workItemLabel(kind)}</option>)}
        </select>
        <select aria-label="Owner filter" onChange={(event) => setOwnerFilter(event.target.value)} value={ownerFilter}>
          <option value="all">Any owner</option>
          {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
        </select>
        <select aria-label="Date filter" onChange={(event) => setDateFilter(event.target.value)} value={dateFilter}>
          <option value="all">Any date</option>
          <option value="overdue">Overdue</option>
          <option value="next_7">Next 7 days</option>
          <option value="next_30">Next 30 days</option>
          <option value="unscheduled">No date</option>
        </select>
        <select aria-label="Group by" onChange={(event) => setGroupBy(event.target.value as GroupBy)} value={groupBy}>
          <option value="hierarchy">Hierarchy</option>
          <option value="status">Status</option>
          <option value="priority">Priority</option>
          <option value="project">Project</option>
          <option value="owner">Owner</option>
          <option value="type">Type</option>
          <option value="due">Due date</option>
        </select>
        <select aria-label="Primary sort" onChange={(event) => setPrimarySort(event.target.value as SortBy)} value={primarySort}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>Sort: {option.label}</option>)}
        </select>
        <select aria-label="Secondary sort" onChange={(event) => setSecondarySort(event.target.value as SortBy)} value={secondarySort}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>Then: {option.label}</option>)}
        </select>
      </section>

      <section className="do-sort-presets" aria-label="Sorting presets">
        <button className={groupBy === "project" && primarySort === "project" && secondarySort === "priority" ? "is-active" : ""} onClick={() => { setGroupBy("project"); setPrimarySort("project"); setSecondarySort("priority"); }} type="button">Project → priority</button>
        <button className={groupBy === "priority" && primarySort === "priority" && secondarySort === "due" ? "is-active" : ""} onClick={() => { setGroupBy("priority"); setPrimarySort("priority"); setSecondarySort("due"); }} type="button">Priority → date</button>
        <button className={groupBy === "priority" && primarySort === "priority" && secondarySort === "project" ? "is-active" : ""} onClick={() => { setGroupBy("priority"); setPrimarySort("priority"); setSecondarySort("project"); }} type="button">Priority → project</button>
      </section>

      <section className="do-items-create">
        <select aria-label="New item project" disabled={Boolean(activeProject)} onChange={(event) => setNewProjectId(event.target.value)} value={newProjectId}>
          <option value="">{activeProject ? projectTitle(activeProject) : "No project / errand"}</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{projectTitle(project)}</option>)}
        </select>
        <select aria-label="New item type" onChange={(event) => { setNewType(event.target.value as WorkItemKind); setNewParentId(""); }} value={newType}>
          {workTypes.map((kind) => <option key={kind} value={kind}>{workItemLabel(kind)}</option>)}
        </select>
        <select aria-label="New item parent" disabled={parentOptions.length === 0} onChange={(event) => setNewParentId(event.target.value)} value={newParentId}>
          <option value="">{newType === "epic" ? "No parent" : "Choose parent"}</option>
          {parentOptions.map((item) => <option key={item.id} value={item.id}>{workItemLabel(workItemKind(item))} · {title(item)}</option>)}
        </select>
        <input aria-label="New work item title" onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createItem()} placeholder={`Add ${workItemLabel(newType)}...`} value={newTitle} />
        <button disabled={!canCreate} onClick={createItem} type="button"><Plus size={13} /> Add</button>
      </section>

      {selectedBulkIds.length > 0 && (
        <section className="do-items-bulk" aria-label="Bulk actions">
          <span><SlidersHorizontal size={13} /> {selectedBulkIds.length} selected</span>
          <select aria-label="Bulk status" onChange={(event) => setBulkStatus(event.target.value)} value={bulkStatus}>{workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select>
          <button onClick={() => updateBulk({ status: bulkStatus })} type="button">Apply status</button>
          <select aria-label="Bulk priority" onChange={(event) => setBulkPriority(event.target.value)} value={bulkPriority}>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
          <button onClick={() => updateBulk({ priority: bulkPriority === "N/A" ? null : bulkPriority })} type="button">Apply priority</button>
          <input aria-label="Bulk due date" onChange={(event) => setBulkDueDate(event.target.value)} type="date" value={bulkDueDate} />
          <button onClick={() => updateBulk({ dueDate: bulkDueDate || null })} type="button">Apply date</button>
        </section>
      )}

      <div className={`do-items-layout ${selectedItem ? "has-detail" : ""}`}>
        <section className={`do-items-workspace is-${mode}`}>
          <div className="do-items-summary">
            <span><strong>{filtered.length}</strong> shown</span>
            <span><strong>{filtered.filter((item) => canonicalStatus(item) === "blocked").length}</strong> blocked</span>
            <span><strong>{filtered.filter((item) => priorityValue(item.priority) === "1").length}</strong> priority 1</span>
            <span><strong>{filtered.filter((item) => dueBucket(item.dueDate || item.targetDate) === "overdue").length}</strong> overdue</span>
          </div>
          {mode === "gantt" ? renderGantt() : groupBy === "hierarchy" ? renderHierarchy() : (
            <div className="do-items-groups">
              {Object.entries(grouped).map(([group, items]) => (
                <section className="do-items-group" key={group}>
                  <button onClick={() => toggleGroup(group)} type="button"><ChevronDown className={collapsedGroups.includes(group) ? "is-collapsed" : ""} size={13} /><strong>{group}</strong><span>{items.length}</span></button>
                  {!collapsedGroups.includes(group) && <div>{items.map((item) => renderRow(item, items))}</div>}
                </section>
              ))}
              {filtered.length === 0 && <div className="do-items-empty"><ListChecks size={21} /><strong>No items match the current filters.</strong><span>Clear a filter or create the next item.</span></div>}
            </div>
          )}
        </section>

        {selectedItem && (
          <aside className="do-item-detail" aria-label="Selected work item detail">
            <div className="do-item-detail-head">
              <span>{workItemLabel(workItemKind(selectedItem))}</span>
              <button aria-label="Close item detail" onClick={() => onSelectItem(null)} type="button">×</button>
            </div>
            <InlineText ariaLabel="Selected item title" onCommit={(next) => next && onUpdateTask(selectedItem.id, { title: next })} value={title(selectedItem)} />
            <textarea
              aria-label="Selected item description"
              defaultValue={selectedItem.description || selectedItem.definitionOfDone || ""}
              onBlur={(event) => onUpdateTask(selectedItem.id, { description: event.target.value })}
              placeholder="Description, acceptance criteria, notes..."
            />
            <label>Status<select onChange={(event) => onUpdateTask(selectedItem.id, { status: event.target.value })} value={canonicalStatus(selectedItem)}>{workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></label>
            <label>Priority<select onChange={(event) => onUpdateTask(selectedItem.id, { priority: event.target.value === "N/A" ? null : event.target.value })} value={priorityValue(selectedItem.priority)}>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
            <label>Owner<input defaultValue={selectedItem.owner || selectedItem.assignee || ""} onBlur={(event) => onUpdateTask(selectedItem.id, { owner: event.target.value.trim(), assignee: event.target.value.trim() })} /></label>
            <label>Due date<input defaultValue={dateInputValue(selectedItem.dueDate || selectedItem.targetDate)} onBlur={(event) => onUpdateTask(selectedItem.id, { dueDate: event.target.value || null })} type="date" /></label>
            <label>Parent<select onChange={(event) => onUpdateTask(selectedItem.id, { parentId: event.target.value || null })} value={parentId(selectedItem)}><option value="">No parent</option>{tasks.filter((item) => item.projectId === selectedItem.projectId && item.id !== selectedItem.id).map((item) => <option key={item.id} value={item.id}>{workItemLabel(workItemKind(item))} · {title(item)}</option>)}</select></label>
            <div className="do-item-detail-actions">
              {currentProject && <button onClick={() => onOpenProjectConsole(currentProject)} type="button"><Folder size={13} /> Console</button>}
              <button onClick={() => onAsk(`Help me move this work item forward: ${title(selectedItem)}`)} type="button"><ArrowRight size={13} /> Ask</button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
