import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  CalendarRange,
  Folder,
  GripVertical,
  ListChecks,
  Kanban,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { TIME_SECTOR_MODEL, normalizeTimeSector } from "../lib/operatingModel";
import { taskWorkLane, type WorkLane } from "../lib/projectPortfolio";
import { matchesTag, tagIds, tagLabels, toggleTagId, type TagLike } from "../lib/tagging";
import { controlledOptionNames } from "../lib/controlledLists";
import { InfoTip, MultiAssigneePicker } from "./ProjectControls";
import { AiRewriteButton } from "./AiRewriteButton";
import { ControlledSelect } from "./ControlledSelect";

type WorkItemKind = "epic" | "feature" | "pbi" | "story" | "task" | "bug" | "subtask";
type WorkItemsViewMode = "list" | "kanban" | "gantt";
type GroupBy = "hierarchy" | "actionBoard" | "status" | "priority" | "project" | "owner" | "type" | "due" | "tag";
type SortBy = "rank" | "project" | "priority" | "due" | "title" | "status" | "owner" | "type" | "delivery_entity" | "client_entity";
type ItemColumnKey =
  | "title"
  | "delivery_entity"
  | "client_entity"
  | "tags"
  | "status"
  | "priority"
  | "gtd"
  | "bucket"
  | "assignees"
  | "due";

type Props = {
  activeProject: any | null;
  projects: any[];
  tasks: any[];
  tags?: TagLike[];
  workspaceMembers?: Array<{ id: string; displayName?: string; email?: string; emailLower?: string; status?: string }>;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onAsk: (prompt: string) => void;
  onAddTask: (projectId: string, title: string, status: WorkLane, patch?: Record<string, unknown>) => Promise<void> | void;
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onCreateControlledOption?: (group: "delivery_entity" | "client_entity" | "tag", name: string) => Promise<string | void> | string | void;
  onOpenProjectConsole: (project: any) => void;
};

const workTypes: WorkItemKind[] = ["epic", "feature", "pbi", "story", "bug", "task", "subtask"];
const workStatuses = ["backlog", "ready", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"];
const priorities = ["1", "2", "3", "N/A"];
const actionBoardBuckets = ["Overdue", "Today", "This week", "Next week", "This month", "Next month", "Later", "Next action", "Waiting", "Someday", "Reference", "No sector"];
const gtdActionTypes = [
  { value: "", label: "GTD: N/A" },
  { value: "next_action", label: "Next action" },
  { value: "waiting_for", label: "Waiting for" },
  { value: "someday", label: "Someday" },
  { value: "reference", label: "Reference" },
  { value: "decision", label: "Decision" },
  { value: "delegated", label: "Delegated" },
  { value: "follow_up", label: "Follow-up" },
];
const dueBucketLabels: Record<string, string> = {
  overdue: "Overdue",
  today: "Today",
  this_week: "This week",
  next_week: "Next week",
  this_month: "This month",
  next_month: "Next month",
  later: "Later",
  unscheduled: "No sector",
};
const dueFilterOptions = ["overdue", "today", "this_week", "next_week", "this_month", "next_month", "later", "unscheduled"];
const sortOptions: Array<{ value: SortBy; label: string }> = [
  { value: "rank", label: "Manual order" },
  { value: "project", label: "Project" },
  { value: "delivery_entity", label: "Delivery Entity" },
  { value: "client_entity", label: "Client Entity" },
  { value: "priority", label: "Priority" },
  { value: "due", label: "Due date" },
  { value: "status", label: "Status" },
  { value: "owner", label: "Owner" },
  { value: "type", label: "Type" },
  { value: "title", label: "Title" },
];

const defaultItemColumns: ItemColumnKey[] = [
  "title",
  "delivery_entity",
  "client_entity",
  "tags",
  "status",
  "priority",
  "gtd",
  "bucket",
  "assignees",
  "due",
];

const itemColumnLabels: Record<ItemColumnKey, string> = {
  title: "Item",
  delivery_entity: "Delivery Entity",
  client_entity: "Client Entity",
  tags: "Tags",
  status: "Status",
  priority: "Priority",
  gtd: "GTD",
  bucket: "Action Board",
  assignees: "Assignees",
  due: "Due",
};

const itemColumnWidths: Record<ItemColumnKey, string> = {
  title: "minmax(210px, 1.25fr)",
  delivery_entity: "minmax(145px, .75fr)",
  client_entity: "minmax(145px, .75fr)",
  tags: "minmax(130px, .7fr)",
  status: "94px",
  priority: "64px",
  gtd: "104px",
  bucket: "92px",
  assignees: "minmax(112px, .75fr)",
  due: "112px",
};

function viewStorageKey(scope: string) {
  return `certo-${scope}-view-config`;
}

function viewWidthsStorageKey(scope: string) {
  return `certo-${scope}-column-widths`;
}

function widthFromTemplate(value: string) {
  const match = value.match(/(\d+)px/);
  return match ? Number(match[1]) : 120;
}

const defaultItemColumnPixels = Object.fromEntries(
  Object.entries(itemColumnWidths).map(([key, value]) => [
    key,
    widthFromTemplate(value),
  ]),
) as Record<ItemColumnKey, number>;

function clampColumnWidth(value: number) {
  return Math.max(72, Math.min(420, Math.round(value)));
}

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

function itemProject(item: any, projects: any[]) {
  return projects.find((project) => project.id === item?.projectId);
}

function deliveryEntity(item: any, projects: any[]) {
  const project = itemProject(item, projects);
  return String(
    item?.deliveryEntity ||
      item?.bpo ||
      project?.deliveryEntity ||
      project?.bpo ||
      "Internal",
  );
}

function clientEntity(item: any, projects: any[]) {
  const project = itemProject(item, projects);
  return String(
    item?.clientEntity ||
      item?.client ||
      project?.clientEntity ||
      project?.client ||
      "Internal",
  );
}

function workItemKind(item: any): WorkItemKind {
  const structuralValue = String(item?.workItemType || item?.taskType || item?.issueType || item?.kind || "").toLowerCase();
  const legacyItemType = String(item?.itemType || "").toLowerCase();
  const value = structuralValue || (workTypes.includes(legacyItemType as WorkItemKind) ? legacyItemType : "");
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
  const sameMonth = due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth();
  const nextMonth = due.getFullYear() === today.getFullYear()
    ? due.getMonth() === today.getMonth() + 1
    : today.getMonth() === 11 && due.getFullYear() === today.getFullYear() + 1 && due.getMonth() === 0;
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "this_week";
  if (days <= 14) return "next_week";
  if (sameMonth) return "this_month";
  if (nextMonth || days <= 60) return "next_month";
  return "later";
}

function actionBoardBucket(item: any) {
  const globalStage = String(item?.globalStageId || "").toLowerCase();
  const bucket = dueBucket(item.dueDate || item.targetDate);
  if (bucket !== "unscheduled") return dueBucketLabels[bucket] || "No sector";
  const actionType = gtdActionValue(item);
  if (globalStage === "waiting" || actionType === "waiting_for") return "Waiting";
  if (globalStage === "someday" || actionType === "someday") return "Someday";
  if (actionType === "reference") return "Reference";
  if (actionType === "next_action") return "Next action";

  const explicitSector = normalizeTimeSector(item?.timeSector || item?.proposed?.timeSector);
  if (explicitSector) {
    return TIME_SECTOR_MODEL.find((sector) => sector.id === explicitSector)?.label || "No sector";
  }

  return "No sector";
}

function gtdActionValue(item: any) {
  const value = String(item?.gtdActionType || item?.actionType || "").toLowerCase();
  if (gtdActionTypes.some((type) => type.value === value)) return value;
  const legacy = String(item?.itemType || item?.globalStageId || "").toLowerCase();
  if (gtdActionTypes.some((type) => type.value === legacy)) return legacy;
  if (legacy === "waiting") return "waiting_for";
  return "";
}

function gtdActionLabel(item: any) {
  return gtdActionTypes.find((type) => type.value === gtdActionValue(item))?.label.replace(/^GTD: /, "") || "N/A";
}

function gtdActionPatch(value: string) {
  return {
    actionType: value || null,
    gtdActionType: value || null,
    globalStageId: value === "someday" ? "someday" : value === "waiting_for" ? "waiting" : null,
  };
}

function displayDueBucket(item: any) {
  return actionBoardBucket(item);
}

function groupSortIndex(groupBy: GroupBy, label: string) {
  if (groupBy === "actionBoard") {
    const index = actionBoardBuckets.indexOf(label);
    return index === -1 ? 999 : index;
  }
  if (groupBy === "priority") {
    const index = priorities.indexOf(label);
    return index === -1 ? 999 : index;
  }
  if (groupBy === "status") {
    const index = workStatuses.indexOf(label);
    return index === -1 ? 999 : index;
  }
  if (groupBy === "due") {
    const key = Object.entries(dueBucketLabels).find(([, value]) => value === label)?.[0] || label;
    const index = dueFilterOptions.indexOf(key);
    return index === -1 ? 999 : index;
  }
  return 999;
}

function itemOrder(item: any, fallback = 0) {
  const value = Number(item?.order ?? item?.rank ?? item?.position);
  return Number.isFinite(value) ? value : fallback;
}

function sortValue(item: any, sortBy: SortBy, projects: any[]) {
  if (sortBy === "project") return itemProjectTitle(item, projects).toLowerCase();
  if (sortBy === "delivery_entity")
    return deliveryEntity(item, projects).toLowerCase();
  if (sortBy === "client_entity")
    return clientEntity(item, projects).toLowerCase();
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

function ItemTagPicker({
  record,
  tags,
  onChange,
  onCreateTag,
  label = "Tags",
}: {
  record: any;
  tags: TagLike[];
  onChange: (patch: Record<string, unknown>) => void;
  onCreateTag?: (name: string) => Promise<string | void> | string | void;
  label?: string;
}) {
  const ids = tagIds(record);
  return (
    <div className="do-tag-picker">
      <div>
        {tagLabels(record, tags).slice(0, 3).map((name) => (
          <span key={name}>{name}</span>
        ))}
        {ids.length === 0 && <small>No tags</small>}
      </div>
      <select
        aria-label={label}
        onChange={(event) => {
          if (!event.target.value) return;
          if (event.target.value === "__create_tag__") {
            const name = window.prompt("Create tag");
            const cleaned = String(name || "").trim();
            event.target.value = "";
            if (!cleaned) return;
            Promise.resolve(onCreateTag?.(cleaned)).then((createdId) => {
              const id = String(createdId || cleaned).trim();
              if (id) onChange(toggleTagId(record, id));
            });
            return;
          }
          onChange(toggleTagId(record, event.target.value));
          event.target.value = "";
        }}
        value=""
      >
        <option value="">+ Tag</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {ids.includes(tag.id) ? "Remove " : "Add "}
            {tag.name || tag.id}
          </option>
        ))}
        {onCreateTag && <option value="__create_tag__">+ Create tag…</option>}
      </select>
    </div>
  );
}

export function WorkItemsCenter({
  activeProject,
  projects,
  tasks,
  tags = [],
  workspaceMembers = [],
  selectedItemId,
  onSelectItem,
  onAsk,
  onAddTask,
  onUpdateTask,
  onCreateControlledOption,
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
  const [tagFilter, setTagFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<GroupBy>(activeProject ? "hierarchy" : "project");
  const [primarySort, setPrimarySort] = useState<SortBy>("project");
  const [secondarySort, setSecondarySort] = useState<SortBy>("priority");
  const [newType, setNewType] = useState<WorkItemKind>("pbi");
  const [newProjectId, setNewProjectId] = useState(activeProject?.id || "");
  const [newParentId, setNewParentId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState("in_progress");
  const [bulkPriority, setBulkPriority] = useState("2");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [itemViewName, setItemViewName] = useState("");
  const [savedItemViews, setSavedItemViews] = useState<
    Array<{
      name: string;
      columns: ItemColumnKey[];
      widths?: Partial<Record<ItemColumnKey, number>>;
    }>
  >(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(viewStorageKey("items")) || "[]");
    } catch {
      return [];
    }
  });
  const [visibleItemColumns, setVisibleItemColumns] = useState<ItemColumnKey[]>(
    () => {
      if (typeof window === "undefined") return defaultItemColumns;
      try {
        const stored = JSON.parse(
          window.localStorage.getItem(viewStorageKey("items-current")) || "null",
        );
        return Array.isArray(stored) && stored.length
          ? stored
          : defaultItemColumns;
      } catch {
        return defaultItemColumns;
      }
    },
  );
  const [itemColumnPixels, setItemColumnPixels] = useState<
    Record<ItemColumnKey, number>
  >(() => {
    if (typeof window === "undefined") return defaultItemColumnPixels;
    try {
      return {
        ...defaultItemColumnPixels,
        ...JSON.parse(
          window.localStorage.getItem(viewWidthsStorageKey("items-current")) ||
            "{}",
        ),
      };
    } catch {
      return defaultItemColumnPixels;
    }
  });
  const itemColumnSet = new Set(visibleItemColumns);
  const itemGridStyle = {
    gridTemplateColumns: `24px 35px ${visibleItemColumns
      .map((column) => `${itemColumnPixels[column] || defaultItemColumnPixels[column]}px`)
      .join(" ")}`,
  };

  const updateItemColumnWidth = (column: ItemColumnKey, value: number) => {
    setItemColumnPixels((current) => {
      const next = { ...current, [column]: clampColumnWidth(value) };
      window.localStorage.setItem(
        viewWidthsStorageKey("items-current"),
        JSON.stringify(next),
      );
      return next;
    });
  };

  const resetItemColumnWidths = () => {
    setItemColumnPixels(defaultItemColumnPixels);
    window.localStorage.setItem(
      viewWidthsStorageKey("items-current"),
      JSON.stringify(defaultItemColumnPixels),
    );
  };

  const toggleItemColumn = (column: ItemColumnKey) => {
    if (column === "title") return;
    setVisibleItemColumns((current) => {
      const next = current.includes(column)
        ? current.filter((candidate) => candidate !== column)
        : defaultItemColumns.filter((candidate) =>
            [...current, column].includes(candidate),
          );
      window.localStorage.setItem(viewStorageKey("items-current"), JSON.stringify(next));
      return next;
    });
  };
  const saveItemView = () => {
    const name = itemViewName.trim();
    if (!name) return;
    const next = [
      ...savedItemViews.filter((candidate) => candidate.name !== name),
      { name, columns: visibleItemColumns, widths: itemColumnPixels },
    ];
    setSavedItemViews(next);
    window.localStorage.setItem(viewStorageKey("items"), JSON.stringify(next));
    setItemViewName("");
  };
  const applyItemView = (name: string) => {
    const saved = savedItemViews.find((candidate) => candidate.name === name);
    if (!saved) return;
    setVisibleItemColumns(saved.columns);
    if (saved.widths) {
      const nextWidths = { ...defaultItemColumnPixels, ...saved.widths };
      setItemColumnPixels(nextWidths);
      window.localStorage.setItem(
        viewWidthsStorageKey("items-current"),
        JSON.stringify(nextWidths),
      );
    }
    window.localStorage.setItem(viewStorageKey("items-current"), JSON.stringify(saved.columns));
  };
  const deleteItemView = (name: string) => {
    const next = savedItemViews.filter((candidate) => candidate.name !== name);
    setSavedItemViews(next);
    window.localStorage.setItem(viewStorageKey("items"), JSON.stringify(next));
  };

  useEffect(() => {
    setProjectFilter(activeProject?.id || "all");
    setNewProjectId(activeProject?.id || "");
    setGroupBy(activeProject ? "hierarchy" : "project");
    setPrimarySort("project");
    setSecondarySort("priority");
    onSelectItem(null);
  }, [activeProject?.id]);

  useEffect(() => setCollapsedGroups([]), [groupBy, primarySort, secondarySort, projectFilter, statusFilter, priorityFilter, typeFilter, ownerFilter, dateFilter, tagFilter, query]);

  const owners = useMemo(
    () => [...new Set([
      ...workspaceMembers
        .filter((member) => String(member.status || "active") !== "removed")
        .map((member) => String(member.displayName || member.email || member.emailLower || "").trim())
        .filter(Boolean),
      ...tasks.map((item) => String(item.owner || item.assignee || "").trim()).filter(Boolean),
    ])].sort(),
    [tasks, workspaceMembers],
  );
  const deliveryEntityOptions = useMemo(
    () =>
      controlledOptionNames(tags, "delivery_entity", [
        ...projects.map((project) => project.deliveryEntity || project.bpo),
        ...tasks.map((item) => item.deliveryEntity || item.bpo),
      ]),
    [projects, tags, tasks],
  );
  const clientEntityOptions = useMemo(
    () =>
      controlledOptionNames(tags, "client_entity", [
        ...projects.map((project) => project.clientEntity || project.client),
        ...tasks.map((item) => item.clientEntity || item.client),
      ]),
    [projects, tags, tasks],
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
      const matchesItemTag = matchesTag(item, tagFilter);
      const searchable = `${title(item)} ${item.description || ""} ${item.key || ""} ${itemProjectTitle(item, projects)} ${deliveryEntity(item, projects)} ${clientEntity(item, projects)} ${tagLabels(item, tags).join(" ")}`.toLowerCase();
      return matchesProject && matchesStatus && matchesPriority && matchesType && matchesOwner && matchesDate && matchesItemTag && (!needle || searchable.includes(needle));
    }), primarySort, secondarySort, projects);
  }, [dateFilter, ownerFilter, priorityFilter, projectFilter, projects, query, primarySort, secondarySort, statusFilter, tagFilter, tags, tasks, typeFilter]);

  const selectedItem = tasks.find((item) => item.id === selectedItemId) || null;
  const currentProject = projects.find((project) => project.id === (selectedItem?.projectId || newProjectId || baseProjectId));
  const canCreate = Boolean(newTitle.trim());

  useEffect(() => {
    setDetailDescription(
      String(selectedItem?.description || selectedItem?.definitionOfDone || ""),
    );
  }, [selectedItem?.id, selectedItem?.description, selectedItem?.definitionOfDone]);

  const createItem = async () => {
    const projectId = newProjectId || baseProjectId;
    if (!newTitle.trim()) return;
    const project = projects.find((candidate) => candidate.id === projectId);
    const inheritedDeliveryEntity = String(
      project?.deliveryEntity || project?.bpo || "",
    );
    const inheritedClientEntity = String(
      project?.clientEntity || project?.client || "",
    );
    const parent = tasks.find((item) => item.id === newParentId);
    const parentKind = parent ? workItemKind(parent) : null;
    await onAddTask(projectId, newTitle.trim(), "backlog", {
      workItemType: newType,
      itemType: newType,
      taskType: newType,
      parentId: newParentId || null,
      epicId: parentKind === "epic" ? newParentId : parent?.epicId || null,
      featureId: parentKind === "feature" ? newParentId : parent?.featureId || null,
      deliveryEntity: inheritedDeliveryEntity,
      bpo: inheritedDeliveryEntity,
      clientEntity: inheritedClientEntity,
      client: inheritedClientEntity,
      priority: null,
      order: tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId).length,
      rank: tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId).length,
    });
    setNewTitle("");
    setNewParentId("");
  };

  const reorderItem = async (
    draggedId: string | null,
    targetId: string,
    peers: any[],
  ) => {
    if (!draggedId || draggedId === targetId) return;
    const ordered = sortItems(peers, "rank", "priority", projects);
    const from = ordered.findIndex((candidate) => candidate.id === draggedId);
    const to = ordered.findIndex((candidate) => candidate.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    await Promise.all(
      ordered.map((candidate, index) => {
        const currentOrder = itemOrder(candidate, index);
        if (currentOrder === index) return Promise.resolve();
        return onUpdateTask(candidate.id, { order: index, rank: index });
      }),
    );
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
      <article
        className={`do-items-row is-${kind} ${selectedItemId === item.id ? "is-selected" : ""} ${draggedItemId === item.id ? "is-dragging" : ""} ${dragOverItemId === item.id ? "is-drag-over" : ""}`}
        key={item.id}
        onDragLeave={() => setDragOverItemId((current) => current === item.id ? null : current)}
        onDragOver={(event) => {
          if (!draggedItemId || draggedItemId === item.id) return;
          event.preventDefault();
          setDragOverItemId(item.id);
        }}
        onDrop={async (event) => {
          event.preventDefault();
          await reorderItem(draggedItemId, item.id, peers);
          setDraggedItemId(null);
          setDragOverItemId(null);
        }}
        style={itemGridStyle}
      >
        <button aria-label={`Select ${title(item)}`} className="do-items-check" onClick={() => toggleBulk(item.id)} type="button">
          {selectedBulkIds.includes(item.id) ? <Check size={12} /> : <Circle size={12} />}
        </button>
        <button
          aria-label={`Drag to reorder ${title(item)}`}
          className="do-items-drag-handle"
          draggable
          onDragEnd={() => {
            setDraggedItemId(null);
            setDragOverItemId(null);
          }}
          onDragStart={(event) => {
            setDraggedItemId(item.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", item.id);
          }}
          title="Drag to reorder"
          type="button"
        >
          <GripVertical size={14} />
        </button>
        {itemColumnSet.has("title") && <button className="do-items-title" onClick={() => onSelectItem(item.id)} type="button">
          <span>{item.key ? `${workItemLabel(kind)} · ${item.key}` : workItemLabel(kind)}</span>
          <InlineText ariaLabel={`Title for ${title(item)}`} onCommit={(next) => next && onUpdateTask(item.id, { title: next })} value={title(item)} />
          <small>{itemProjectTitle(item, projects)}{children.length ? ` · ${children.length} child item${children.length === 1 ? "" : "s"}` : ""}{Array.isArray(item.dependencyIds) && item.dependencyIds.length ? ` · ${item.dependencyIds.length} deps` : ""}</small>
        </button>}
        {itemColumnSet.has("delivery_entity") && <ControlledSelect ariaLabel={`Delivery Entity for ${title(item)}`} onAddOption={(name) => onCreateControlledOption?.("delivery_entity", name)} onChange={(next) => onUpdateTask(item.id, { deliveryEntity: next || "Internal", bpo: next || "Internal" })} options={deliveryEntityOptions} value={deliveryEntity(item, projects)} />}
        {itemColumnSet.has("client_entity") && <ControlledSelect ariaLabel={`Client Entity for ${title(item)}`} onAddOption={(name) => onCreateControlledOption?.("client_entity", name)} onChange={(next) => onUpdateTask(item.id, { clientEntity: next || "Internal", client: next || "Internal" })} options={clientEntityOptions} value={clientEntity(item, projects)} />}
        {itemColumnSet.has("tags") && <ItemTagPicker label={`Tags for ${title(item)}`} onCreateTag={(name) => onCreateControlledOption?.("tag", name)} onChange={(patch) => onUpdateTask(item.id, patch)} record={item} tags={tags} />}
        {itemColumnSet.has("status") && <select aria-label={`Status for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { status: event.target.value })} value={canonicalStatus(item)}>
          {workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}
        </select>}
        {itemColumnSet.has("priority") && <select aria-label={`Priority for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { priority: event.target.value === "N/A" ? null : event.target.value })} value={priorityValue(item.priority)}>
          {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>}
        {itemColumnSet.has("gtd") && <select aria-label={`GTD action type for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, gtdActionPatch(event.target.value))} value={gtdActionValue(item)}>
          {gtdActionTypes.map((type) => <option key={type.value || "none"} value={type.value}>{type.label}</option>)}
        </select>}
        {itemColumnSet.has("bucket") && <span className="do-items-when" aria-label={`Action Board bucket for ${title(item)}`}>{displayDueBucket(item)}</span>}
        {itemColumnSet.has("assignees") && <MultiAssigneePicker members={workspaceMembers} onChange={(assigneeIds, assignees) => onUpdateTask(item.id, { assigneeIds, assignees, owner: assignees[0] || "", assignee: assignees[0] || "" })} selectedIds={Array.isArray(item.assigneeIds) ? item.assigneeIds : []} selectedNames={Array.isArray(item.assignees) ? item.assignees : [item.owner || item.assignee].filter(Boolean)} />}
        {itemColumnSet.has("due") && <input aria-label={`Due date for ${title(item)}`} defaultValue={dateInputValue(item.dueDate || item.targetDate)} onBlur={(event) => onUpdateTask(item.id, { dueDate: event.target.value || null })} type="date" />}
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
      if (groupBy === "actionBoard") return actionBoardBucket(item);
      if (groupBy === "status") return canonicalStatus(item);
      if (groupBy === "priority") return priorityValue(item.priority);
      if (groupBy === "project") return itemProjectTitle(item, projects);
      if (groupBy === "owner") return String(item.owner || item.assignee || "Unassigned");
      if (groupBy === "type") return workItemLabel(workItemKind(item));
      if (groupBy === "due") return dueBucketLabels[dueBucket(item.dueDate || item.targetDate)] || "No sector";
      if (groupBy === "tag") return tagLabels(item, tags)[0] || "No tag";
      return "Items";
    };
    return filtered.reduce<Record<string, any[]>>((acc, item) => {
      const key = keyFor(item);
      acc[key] = [...(acc[key] || []), item];
      return acc;
    }, {});
  }, [filtered, groupBy, projects, tags]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((current) => current.includes(group)
      ? current.filter((item) => item !== group)
      : [...current, group]);
  };

  const renderBoardCard = (item: any) => {
    const kind = workItemKind(item);
    const due = dateInputValue(item.dueDate || item.targetDate);
    return (
      <article className={`do-kanban-card is-${kind} ${selectedItemId === item.id ? "is-selected" : ""}`} key={item.id}>
        <button className="do-kanban-card-title" onClick={() => onSelectItem(item.id)} type="button">
          <span>{item.key ? `${workItemLabel(kind)} · ${item.key}` : workItemLabel(kind)}</span>
          <strong>{title(item)}</strong>
          <small>{itemProjectTitle(item, projects)}</small>
        </button>
        <div className="do-kanban-card-meta">
          <select aria-label={`Status for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { status: event.target.value })} value={canonicalStatus(item)}>
            {workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}
          </select>
          <select aria-label={`Priority for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { priority: event.target.value === "N/A" ? null : event.target.value })} value={priorityValue(item.priority)}>
            {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </div>
        <div className="do-kanban-card-foot">
          <MultiAssigneePicker
            label="Item assignees"
            members={workspaceMembers}
            onChange={(assigneeIds, assignees) => onUpdateTask(item.id, { assigneeIds, assignees, owner: assignees[0] || "", assignee: assignees[0] || "" })}
            selectedIds={Array.isArray(item.assigneeIds) ? item.assigneeIds : []}
            selectedNames={Array.isArray(item.assignees) ? item.assignees : [item.owner || item.assignee].filter(Boolean)}
          />
          <span>{groupBy === "actionBoard" ? `${displayDueBucket(item)} · ${gtdActionLabel(item)}` : due || "No date"}</span>
        </div>
        <select aria-label={`GTD action type for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, gtdActionPatch(event.target.value))} value={gtdActionValue(item)}>
          {gtdActionTypes.map((type) => <option key={type.value || "none"} value={type.value}>{type.label}</option>)}
        </select>
        <input aria-label={`Due date for ${title(item)}`} defaultValue={due} onBlur={(event) => onUpdateTask(item.id, { dueDate: event.target.value || null })} type="date" />
      </article>
    );
  };

  const renderKanban = () => {
    const columns = groupBy === "hierarchy"
      ? workStatuses.map((status) => ({ key: status, title: displayStatus(status), items: filtered.filter((item) => canonicalStatus(item) === status) }))
      : Object.entries(grouped)
        .map(([key, items]) => ({ key, title: groupBy === "status" ? displayStatus(key) : key, items }))
        .sort((left, right) => {
          const leftIndex = groupSortIndex(groupBy, left.key);
          const rightIndex = groupSortIndex(groupBy, right.key);
          if (leftIndex !== rightIndex) return leftIndex - rightIndex;
          return left.title.localeCompare(right.title);
        });
    const visibleColumns = columns.filter((column) => column.items.length > 0 || groupBy === "hierarchy");

    return (
      <div className={`do-kanban-board ${groupBy === "actionBoard" ? "is-action-board" : "is-dynamic-board"}`}>
        {visibleColumns.map((column) => (
          <section className="do-kanban-column" key={column.key}>
            <header>
              <strong>{column.title}</strong>
              <span>{column.items.length}</span>
            </header>
            <div>
              {column.items.map((item) => renderBoardCard(item))}
              {column.items.length === 0 && <p>No items</p>}
            </div>
          </section>
        ))}
        {filtered.length === 0 && <div className="do-items-empty"><ListChecks size={21} /><strong>No items match the current filters.</strong><span>Clear a filter or create the next item.</span></div>}
      </div>
    );
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
        <datalist id="do-workspace-member-options">
          {owners.map((owner) => <option key={owner} value={owner} />)}
        </datalist>
        <div className="do-items-mode" aria-label="Work item view">
          <button aria-label="List view" className={mode === "list" ? "is-active" : ""} onClick={() => setMode("list")} type="button"><ListChecks size={14} /></button>
          <button aria-label="Kanban view" className={mode === "kanban" ? "is-active" : ""} onClick={() => setMode("kanban")} type="button"><Kanban size={14} /></button>
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
          {dueFilterOptions.map((option) => <option key={option} value={option}>{dueBucketLabels[option]}</option>)}
        </select>
        <select aria-label="Tag filter" onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
          <option value="all">Any tag</option>
          {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name || tag.id}</option>)}
        </select>
        <select aria-label="Group by" onChange={(event) => setGroupBy(event.target.value as GroupBy)} value={groupBy}>
          <option value="hierarchy">Hierarchy</option>
          <option value="actionBoard">Action Board</option>
          <option value="status">Status</option>
          <option value="priority">Priority</option>
          <option value="project">Project</option>
          <option value="owner">Owner</option>
          <option value="type">Type</option>
          <option value="tag">Tag</option>
          <option value="due">Due date</option>
        </select>
        <select aria-label="Primary sort" onChange={(event) => setPrimarySort(event.target.value as SortBy)} value={primarySort}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>Sort: {option.label}</option>)}
        </select>
        <select aria-label="Secondary sort" onChange={(event) => setSecondarySort(event.target.value as SortBy)} value={secondarySort}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>Then: {option.label}</option>)}
        </select>
      </section>
      <details className="do-view-manager">
        <summary>
          <SlidersHorizontal size={13} /> Item views & columns
        </summary>
        <div className="do-view-manager-body">
          <label>
            Saved views
            <select aria-label="Apply saved item view" onChange={(event) => applyItemView(event.target.value)} value="">
              <option value="">Choose saved view</option>
              {savedItemViews.map((saved) => <option key={saved.name} value={saved.name}>{saved.name}</option>)}
            </select>
          </label>
          <label>
            New view name
            <input onChange={(event) => setItemViewName(event.target.value)} placeholder="Backlog grooming" value={itemViewName} />
          </label>
          <button onClick={saveItemView} type="button">Save current view</button>
          <div className="do-column-picker">
            {defaultItemColumns.filter((column) => column !== "title").map((column) => (
              <label key={column}>
                <input checked={visibleItemColumns.includes(column)} onChange={() => toggleItemColumn(column)} type="checkbox" />
                {itemColumnLabels[column]}
              </label>
            ))}
          </div>
          <div className="do-column-widths">
            <div>
              <strong>Column widths</strong>
              <button onClick={resetItemColumnWidths} type="button">
                Reset
              </button>
            </div>
            {visibleItemColumns.map((column) => (
              <label key={`item-width-${column}`}>
                <span>{itemColumnLabels[column]}</span>
                <input
                  aria-label={`${itemColumnLabels[column]} width`}
                  max={420}
                  min={72}
                  onChange={(event) =>
                    updateItemColumnWidth(column, Number(event.target.value))
                  }
                  type="range"
                  value={
                    itemColumnPixels[column] || defaultItemColumnPixels[column]
                  }
                />
                <small>
                  {itemColumnPixels[column] || defaultItemColumnPixels[column]}
                  px
                </small>
              </label>
            ))}
          </div>
          {savedItemViews.length > 0 && (
            <div className="do-saved-view-list">
              {savedItemViews.map((saved) => (
                <button key={saved.name} onClick={() => deleteItemView(saved.name)} type="button">
                  Delete {saved.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </details>
      <div className="do-items-helpbar"><span>Group, then sort twice <InfoTip label="Two-level sorting" text="Group controls the visible sections. Primary sort orders items first; secondary sort breaks ties inside that order." /></span><span>Board <InfoTip label="Board view" text="A visual execution view for moving work through status. Backlog remains the source for hierarchy and planning." /></span><span>Assignees <InfoTip label="Multiple assignees" text="Select one or many workspace members. The first selected person is retained as the primary owner for compatibility." /></span></div>

      <section className="do-sort-presets" aria-label="Sorting presets">
        <button className={groupBy === "actionBoard" && primarySort === "priority" && secondarySort === "due" ? "is-active" : ""} onClick={() => { setGroupBy("actionBoard"); setPrimarySort("priority"); setSecondarySort("due"); setMode("kanban"); }} type="button">Action Board</button>
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
        <div className="do-ai-create-field"><input aria-label="New work item title" onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createItem()} placeholder={`Add ${workItemLabel(newType)}...`} value={newTitle} /><AiRewriteButton context={{ itemType: newType, project: currentProject ? projectTitle(currentProject) : "No project" }} fieldKind="work_item_title" onRewrite={setNewTitle} text={newTitle} /></div>
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
          {mode === "gantt" ? renderGantt() : mode === "kanban" ? renderKanban() : groupBy === "hierarchy" ? renderHierarchy() : (
            <div className="do-items-groups">
              {Object.entries(grouped).sort(([left], [right]) => {
                const leftIndex = groupSortIndex(groupBy, left);
                const rightIndex = groupSortIndex(groupBy, right);
                if (leftIndex !== rightIndex) return leftIndex - rightIndex;
                return left.localeCompare(right);
              }).map(([group, items]) => (
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
            <div className="do-ai-inline-field"><InlineText ariaLabel="Selected item title" onCommit={(next) => next && onUpdateTask(selectedItem.id, { title: next })} value={title(selectedItem)} /><AiRewriteButton context={{ itemType: workItemKind(selectedItem), project: currentProject ? projectTitle(currentProject) : "No project" }} fieldKind="work_item_title" onRewrite={(next) => onUpdateTask(selectedItem.id, { title: next })} text={title(selectedItem)} /></div>
            <div className="do-ai-description-field"><textarea
              aria-label="Selected item description"
              onBlur={() => detailDescription !== String(selectedItem.description || selectedItem.definitionOfDone || "") && onUpdateTask(selectedItem.id, { description: detailDescription })}
              onChange={(event) => setDetailDescription(event.target.value)}
              placeholder="Description, acceptance criteria, notes..."
              value={detailDescription}
            /><AiRewriteButton context={{ itemTitle: title(selectedItem), itemType: workItemKind(selectedItem), project: currentProject ? projectTitle(currentProject) : "No project" }} fieldKind="work_item_description" onRewrite={(next) => { setDetailDescription(next); return onUpdateTask(selectedItem.id, { description: next }); }} text={detailDescription} /></div>
            <label>Status<select onChange={(event) => onUpdateTask(selectedItem.id, { status: event.target.value })} value={canonicalStatus(selectedItem)}>{workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></label>
            <label>Priority<select onChange={(event) => onUpdateTask(selectedItem.id, { priority: event.target.value === "N/A" ? null : event.target.value })} value={priorityValue(selectedItem.priority)}>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
            <label>GTD type<select onChange={(event) => onUpdateTask(selectedItem.id, gtdActionPatch(event.target.value))} value={gtdActionValue(selectedItem)}>{gtdActionTypes.map((type) => <option key={type.value || "none"} value={type.value}>{type.label}</option>)}</select></label>
            <label>Action Board bucket<span className="do-item-computed-field">{displayDueBucket(selectedItem)}</span></label>
            <label>Delivery Entity<ControlledSelect ariaLabel="Selected item delivery entity" onAddOption={(name) => onCreateControlledOption?.("delivery_entity", name)} onChange={(next) => onUpdateTask(selectedItem.id, { deliveryEntity: next || "Internal", bpo: next || "Internal" })} options={deliveryEntityOptions} value={deliveryEntity(selectedItem, projects)} /></label>
            <label>Client Entity<ControlledSelect ariaLabel="Selected item client entity" onAddOption={(name) => onCreateControlledOption?.("client_entity", name)} onChange={(next) => onUpdateTask(selectedItem.id, { clientEntity: next || "Internal", client: next || "Internal" })} options={clientEntityOptions} value={clientEntity(selectedItem, projects)} /></label>
            <label>Tags<ItemTagPicker label="Selected item tags" onCreateTag={(name) => onCreateControlledOption?.("tag", name)} onChange={(patch) => onUpdateTask(selectedItem.id, patch)} record={selectedItem} tags={tags} /></label>
            <label>Assignees <InfoTip label="Item assignees" text="Assign one or many workspace members. The first selected person remains the primary owner for older reports and filters." /></label>
            <MultiAssigneePicker
              label="Item assignees"
              members={workspaceMembers}
              onChange={(assigneeIds, assignees) => onUpdateTask(selectedItem.id, { assigneeIds, assignees, owner: assignees[0] || "", assignee: assignees[0] || "" })}
              selectedIds={Array.isArray(selectedItem.assigneeIds) ? selectedItem.assigneeIds : []}
              selectedNames={Array.isArray(selectedItem.assignees) ? selectedItem.assignees : [selectedItem.owner || selectedItem.assignee].filter(Boolean)}
            />
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
