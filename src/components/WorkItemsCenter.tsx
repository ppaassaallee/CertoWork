import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  CalendarRange,
  Clipboard,
  Folder,
  GripVertical,
  ListChecks,
  Kanban,
  Plus,
  Search,
  SlidersHorizontal,
  Square,
  X,
} from "./ui/Icon";
import { TIME_SECTOR_MODEL, normalizeTimeSector } from "../lib/operatingModel";
import { taskWorkLane, type WorkLane } from "../lib/projectPortfolio";
import { taskDueStatus } from "./ui/StatusLight";
import { matchesTag, tagLabels, type TagLike } from "../lib/tagging";
import { controlledOptionNames } from "../lib/controlledLists";
import { PRODUCT_PHASES, WORK_CATEGORIES, productPhase, workCategory } from "../lib/workClassification";
import { InfoTip, MultiAssigneePicker, memberName } from "./ProjectControls";
import { looksLikeEmail } from "../lib/workspaceCollaboration";
import {
  collaborationShareGrant,
  withCollaboratorAccess,
} from "../lib/collaborationAccess";
import { AiRewriteButton } from "./AiRewriteButton";
import { ControlledSelect } from "./ControlledSelect";
import { KANBAN_COLUMNS, kanbanColumnForStatus, statusForKanbanColumn } from "../lib/kanbanBoard";
import { itemMatchesSprint, type SprintRecord } from "../lib/sprints";
import { CompactTagPicker } from "./CompactTagPicker";
import { countBulkPasteItems, parseBulkPasteItems, type BulkPasteNode } from "../lib/bulkPasteItems";
import { useMobileCore } from "../hooks/useMobileCore";
import { useAuth } from "../lib/AuthContext";
import {
  itemViewSurface,
  normalizeItemViewFilters,
  pullRemoteItemViewMemory,
  pushRemoteItemViewMemory,
  readLastItemSession,
  readLastItemSessions,
  readNamedItemViews,
  upsertNamedItemView,
  writeLastItemSession,
  writeNamedItemViews,
  type ItemColumnKey,
  type ItemGroupBy,
  type ItemSavedView,
  type ItemSortBy,
  type ItemViewFilters,
  type ItemViewSession,
  type WorkItemsViewMode,
} from "../lib/itemViewMemory";

type WorkItemKind = "epic" | "feature" | "pbi" | "story" | "task" | "bug" | "subtask";
type GroupBy = ItemGroupBy;
type SortBy = ItemSortBy;

type Props = {
  activeProject: any | null;
  projects: any[];
  tasks: any[];
  tags?: TagLike[];
  workspaceMembers?: Array<{ id: string; displayName?: string; email?: string; emailLower?: string; status?: string; userId?: string }>;
  sprints?: SprintRecord[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onAsk: (prompt: string) => void;
  onAddTask: (projectId: string, title: string, status: WorkLane, patch?: Record<string, unknown>) => Promise<string | void> | void;
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onCreateControlledOption?: (group: "delivery_entity" | "client_entity" | "tag", name: string) => Promise<string | void> | string | void;
  onOpenProjectConsole: (project: any) => void;
  onCreateSprint?: (patch: Record<string, unknown>) => Promise<void> | void;
  onUpdateSprint?: (sprintId: string, patch: Record<string, unknown>) => Promise<void> | void;
  compact?: boolean;
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
  { value: "work_category", label: "Work Category" },
  { value: "product_phase", label: "Product Phase" },
  { value: "priority", label: "Priority" },
  { value: "due", label: "Due date" },
  { value: "status", label: "Status" },
  { value: "owner", label: "Owner" },
  { value: "type", label: "Type" },
  { value: "title", label: "Title" },
];

const defaultItemColumns: ItemColumnKey[] = [
  "title",
  "project",
  "delivery_entity",
  "client_entity",
  "tags",
  "work_category",
  "product_phase",
  "status",
  "priority",
  "gtd",
  "bucket",
  "assignees",
  "due",
  "sprint",
];

const itemColumnLabels: Record<ItemColumnKey, string> = {
  title: "Item",
  project: "Project",
  delivery_entity: "Delivery Entity",
  client_entity: "Client Entity",
  tags: "Tags",
  work_category: "Work Category",
  product_phase: "Product Phase",
  status: "Status",
  priority: "Priority",
  gtd: "GTD",
  bucket: "Action Board",
  assignees: "Assignees",
  due: "Due",
  sprint: "Sprint",
};

const itemColumnWidths: Record<ItemColumnKey, string> = {
  title: "minmax(210px, 1.25fr)",
  project: "minmax(150px, .8fr)",
  delivery_entity: "minmax(145px, .75fr)",
  client_entity: "minmax(145px, .75fr)",
  tags: "minmax(130px, .7fr)",
  work_category: "minmax(140px, .75fr)",
  product_phase: "minmax(110px, .6fr)",
  status: "94px",
  priority: "64px",
  gtd: "104px",
  bucket: "92px",
  assignees: "minmax(112px, .75fr)",
  due: "112px",
  sprint: "minmax(120px, .7fr)",
};

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
  return Math.max(56, Math.min(720, Math.round(value)));
}

function selectableItemColumns() {
  return defaultItemColumns.filter((column) => column !== "title");
}

function selectedItemColumns(value: ItemColumnKey[] | null) {
  const current = value?.length ? [...value] : [...defaultItemColumns];
  (["work_category", "product_phase"] as ItemColumnKey[]).forEach((column) => {
    if (!current.includes(column)) current.push(column);
  });
  return defaultItemColumns.filter((column) => current.includes(column));
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

function itemWorkCategory(item: any, projects: any[]) {
  return workCategory(item, itemProject(item, projects));
}

function itemProductPhase(item: any, projects: any[]) {
  return productPhase(item, itemProject(item, projects));
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
  if (kind === "subtask") return "Subtask";
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
  if (sortBy === "work_category")
    return itemWorkCategory(item, projects).toLowerCase();
  if (sortBy === "product_phase")
    return itemProductPhase(item, projects).toLowerCase();
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
  tags = [],
  workspaceMembers = [],
  sprints = [],
  selectedItemId,
  onSelectItem,
  onAsk,
  onAddTask,
  onUpdateTask,
  onCreateControlledOption,
  onOpenProjectConsole,
  onCreateSprint,
  onUpdateSprint: _onUpdateSprint,
  compact = false,
}: Props) {
  const mobileCore = useMobileCore();
  const { user, workspace } = useAuth();
  const viewerId = user?.uid || "";
  const workspaceId = workspace?.id || "";
  const surface = itemViewSurface(activeProject?.id);
  const viewHydrated = useRef(false);
  const skipPersist = useRef(true);
  const remotePushTimer = useRef<number | null>(null);
  const [mode, setMode] = useState<WorkItemsViewMode>("list");
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState(activeProject?.id || "all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [workCategoryFilter, setWorkCategoryFilter] = useState("all");
  const [productPhaseFilter, setProductPhaseFilter] = useState("all");
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
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkSprintId, setBulkSprintId] = useState("");
  const [bulkProjectId, setBulkProjectId] = useState("");
  const [bulkShareId, setBulkShareId] = useState("");
  const [sprintFilter, setSprintFilter] = useState("all");
  const [ganttScale, setGanttScale] = useState<"week" | "month">("week");
  const [sprintName, setSprintName] = useState("");
  const [kanbanError, setKanbanError] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [itemViewName, setItemViewName] = useState("");
  const [viewSaveError, setViewSaveError] = useState("");
  const [viewSaveNotice, setViewSaveNotice] = useState("");
  const [chromeCollapsed, setChromeCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("certo-items-focus-list") === "true";
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addSprintOpen, setAddSprintOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);
  const [pasteError, setPasteError] = useState("");
  const [filterDraft, setFilterDraft] = useState("status");
  const [savedItemViews, setSavedItemViews] = useState<ItemSavedView[]>([]);
  const [visibleItemColumns, setVisibleItemColumns] = useState<ItemColumnKey[]>(defaultItemColumns);
  const [itemColumnPixels, setItemColumnPixels] = useState<Record<ItemColumnKey, number>>(defaultItemColumnPixels);
  const itemColumnSet = new Set(
    mobileCore ? (["title", "status", "priority", "due"] as ItemColumnKey[]) : visibleItemColumns,
  );
  const itemGridStyle = {
    gridTemplateColumns: `20px 20px 28px ${[...itemColumnSet]
      .map((column) => `${itemColumnPixels[column] || defaultItemColumnPixels[column]}px`)
      .join(" ")}`,
  };
  const currentItemViewFilters: ItemViewFilters = {
    mode,
    projectFilter,
    statusFilter,
    priorityFilter,
    typeFilter,
    ownerFilter,
    dateFilter,
    tagFilter,
    workCategoryFilter,
    productPhaseFilter,
    groupBy,
    primarySort,
    secondarySort,
    query,
    sprintFilter,
  };

  const applyViewSession = (session: ItemViewSession | null) => {
    const filters = normalizeItemViewFilters(session?.filters, activeProject?.id);
    setVisibleItemColumns(selectedItemColumns(session?.columns?.length ? session.columns : defaultItemColumns));
    setItemColumnPixels({ ...defaultItemColumnPixels, ...(session?.widths || {}) });
    setMode(filters.mode);
    setProjectFilter(activeProject?.id || filters.projectFilter || "all");
    setStatusFilter(filters.statusFilter);
    setPriorityFilter(filters.priorityFilter);
    setTypeFilter(filters.typeFilter);
    setOwnerFilter(filters.ownerFilter);
    setDateFilter(filters.dateFilter);
    setTagFilter(filters.tagFilter);
    setWorkCategoryFilter(filters.workCategoryFilter);
    setProductPhaseFilter(filters.productPhaseFilter);
    setGroupBy(filters.groupBy);
    setPrimarySort(filters.primarySort);
    setSecondarySort(filters.secondarySort);
    setSprintFilter(filters.sprintFilter || "all");
  };

  const persistRemoteMemory = (views: ItemSavedView[], sessions: Record<string, ItemViewSession>) => {
    if (!viewerId || !workspaceId) return;
    if (remotePushTimer.current) window.clearTimeout(remotePushTimer.current);
    remotePushTimer.current = window.setTimeout(() => {
      pushRemoteItemViewMemory(viewerId, workspaceId, { views, sessions }).catch(() => undefined);
    }, 500);
  };

  const updateItemColumnWidth = (column: ItemColumnKey, value: number) => {
    setItemColumnPixels((current) => ({ ...current, [column]: clampColumnWidth(value) }));
  };

  const resetItemColumnWidths = () => {
    setItemColumnPixels(defaultItemColumnPixels);
  };

  const toggleItemColumn = (column: ItemColumnKey) => {
    if (column === "title") return;
    setVisibleItemColumns((current) => (
      current.includes(column)
        ? current.filter((candidate) => candidate !== column)
        : defaultItemColumns.filter((candidate) =>
            [...current, column].includes(candidate),
          )
    ));
  };
  const saveItemView = () => {
    const name = itemViewName.trim();
    if (!name) {
      setViewSaveError("Name this view first");
      setViewSaveNotice("");
      return false;
    }
    if (!viewerId) {
      setViewSaveError("Sign in to save views for your user");
      setViewSaveNotice("");
      return false;
    }
    const nextView: ItemSavedView = {
      name,
      columns: visibleItemColumns,
      widths: itemColumnPixels,
      filters: currentItemViewFilters,
    };
    const next = upsertNamedItemView(savedItemViews, nextView);
    setSavedItemViews(next);
    writeNamedItemViews(viewerId, next);
    persistRemoteMemory(next, writeLastItemSession(viewerId, surface, {
      columns: visibleItemColumns,
      widths: itemColumnPixels,
      filters: currentItemViewFilters,
    }));
    setItemViewName("");
    setViewSaveError("");
    setViewSaveNotice(`Saved “${name}”`);
    return true;
  };
  const applyItemView = (name: string) => {
    const saved = savedItemViews.find((candidate) => candidate.name === name);
    if (!saved) return;
    applyViewSession({
      columns: saved.columns,
      widths: saved.widths,
      filters: normalizeItemViewFilters(saved.filters, activeProject?.id),
    });
    setViewsOpen(false);
  };
  const deleteItemView = (name: string) => {
    const next = savedItemViews.filter((candidate) => candidate.name !== name);
    setSavedItemViews(next);
    if (viewerId) {
      writeNamedItemViews(viewerId, next);
      persistRemoteMemory(next, readLastItemSessions(viewerId));
    }
  };

  useEffect(() => {
    setNewProjectId(activeProject?.id || "");
    onSelectItem(null);
  }, [activeProject?.id]);

  useEffect(() => {
    skipPersist.current = true;
    viewHydrated.current = false;
    if (!viewerId) return;
    const localViews = readNamedItemViews(viewerId);
    setSavedItemViews(localViews);
    applyViewSession(readLastItemSession(viewerId, surface));
    viewHydrated.current = true;
    let cancelled = false;
    if (!workspaceId) return;
    pullRemoteItemViewMemory(viewerId, workspaceId)
      .then((remote) => {
        if (cancelled || !remote) return;
        const mergedViews = [...localViews];
        for (const view of remote.views) {
          if (!mergedViews.some((candidate) => candidate.name === view.name)) mergedViews.push(view);
        }
        if (mergedViews.length !== localViews.length) {
          setSavedItemViews(mergedViews);
          writeNamedItemViews(viewerId, mergedViews);
        }
        if (!readLastItemSession(viewerId, surface) && remote.sessions[surface]) {
          skipPersist.current = true;
          applyViewSession(remote.sessions[surface]);
          writeLastItemSession(viewerId, surface, remote.sessions[surface]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [viewerId, workspaceId, surface]);

  useEffect(() => {
    if (!viewerId || !viewHydrated.current) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    const session: ItemViewSession = {
      columns: visibleItemColumns,
      widths: itemColumnPixels,
      filters: {
        ...currentItemViewFilters,
        query: "",
      },
    };
    persistRemoteMemory(savedItemViews, writeLastItemSession(viewerId, surface, session));
  }, [
    viewerId,
    surface,
    visibleItemColumns,
    itemColumnPixels,
    mode,
    projectFilter,
    statusFilter,
    priorityFilter,
    typeFilter,
    ownerFilter,
    dateFilter,
    tagFilter,
    workCategoryFilter,
    productPhaseFilter,
    groupBy,
    primarySort,
    secondarySort,
    sprintFilter,
    savedItemViews,
  ]);

  useEffect(() => () => {
    if (remotePushTimer.current) window.clearTimeout(remotePushTimer.current);
  }, []);

  useEffect(() => setCollapsedGroups([]), [groupBy, primarySort, secondarySort, projectFilter, statusFilter, priorityFilter, typeFilter, ownerFilter, dateFilter, tagFilter, workCategoryFilter, productPhaseFilter, query]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("certo-items-focus-list", String(chromeCollapsed));
  }, [chromeCollapsed]);

  useEffect(() => {
    if (mobileCore && mode !== "list") setMode("list");
  }, [mobileCore, mode]);

  const owners = useMemo(
    () => [...new Set([
      ...workspaceMembers
        .filter((member) => String(member.status || "active") !== "removed")
        .map((member) => memberName(member))
        .filter((name) => name && name !== "Needs alias" && !looksLikeEmail(name)),
      ...tasks.map((item) => String(item.owner || item.assignee || "").trim()).filter((name) => name && !looksLikeEmail(name)),
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
        (statusFilter === "open" ? !["done", "completed", "closed", "cancelled", "archived", "deleted"].includes(String(item.status || "").toLowerCase()) : canonicalStatus(item) === statusFilter);
      const matchesPriority = priorityFilter === "all" || priorityValue(item.priority) === priorityFilter;
      const itemKind = workItemKind(item);
      const matchesType = typeFilter === "all" ||
        itemKind === typeFilter ||
        (typeFilter === "pbi" && ["pbi", "story", "task", "bug"].includes(itemKind));
      const matchesOwner = ownerFilter === "all" || String(item.owner || item.assignee || "") === ownerFilter;
      const matchesDate = dateFilter === "all" || dueBucket(item.dueDate || item.targetDate) === dateFilter;
      const matchesItemTag = matchesTag(item, tagFilter);
      const matchesWorkCategory = workCategoryFilter === "all" || itemWorkCategory(item, projects) === workCategoryFilter;
      const matchesProductPhase = productPhaseFilter === "all" || itemProductPhase(item, projects) === productPhaseFilter;
      const matchesSprint = itemMatchesSprint(item, sprintFilter);
      const searchable = `${title(item)} ${item.description || ""} ${item.key || ""} ${itemProjectTitle(item, projects)} ${deliveryEntity(item, projects)} ${clientEntity(item, projects)} ${itemWorkCategory(item, projects)} ${itemProductPhase(item, projects)} ${tagLabels(item, tags).join(" ")}`.toLowerCase();
      return matchesProject && matchesStatus && matchesPriority && matchesType && matchesOwner && matchesDate && matchesItemTag && matchesWorkCategory && matchesProductPhase && matchesSprint && (!needle || searchable.includes(needle));
    }), primarySort, secondarySort, projects);
  }, [dateFilter, ownerFilter, priorityFilter, productPhaseFilter, projectFilter, projects, query, primarySort, secondarySort, sprintFilter, statusFilter, tagFilter, tags, tasks, typeFilter, workCategoryFilter]);

  const selectedItem = tasks.find((item) => item.id === selectedItemId) || null;
  const currentProject = projects.find((project) => project.id === (selectedItem?.projectId || newProjectId || baseProjectId));
  const canCreate = Boolean(newTitle.trim());
  const pasteTree = useMemo(() => parseBulkPasteItems(pasteText), [pasteText]);
  const pasteCounts = useMemo(() => countBulkPasteItems(pasteTree), [pasteTree]);

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
      workCategory: project ? workCategory(project) : "Personal / Errand",
      productPhase: project ? productPhase(project) : "Explore",
      priority: null,
      order: tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId).length,
      rank: tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId).length,
    });
    setNewTitle("");
    setNewParentId("");
  };

  const createBulkNodes = async (
    nodes: BulkPasteNode[],
    projectId: string,
    parentId: string,
    parentKind: WorkItemKind | null,
    startOrder: number,
  ) => {
    let order = startOrder;
    for (const node of nodes) {
      const kind = parentId ? "subtask" : "pbi";
      const createdId = await onAddTask(projectId, node.title, "backlog", {
        workItemType: kind,
        itemType: kind,
        taskType: kind,
        parentId: parentId || null,
        epicId: parentKind === "epic" ? parentId : null,
        featureId: parentKind === "feature" ? parentId : null,
        source: "bulk_paste",
        priority: null,
        order,
        rank: order,
      });
      order += 1;
      if (node.children.length && createdId) {
        order = await createBulkNodes(node.children, projectId, createdId, kind, order);
      }
    }
    return order;
  };

  const createBulkItems = async () => {
    const nodes = parseBulkPasteItems(pasteText);
    if (!nodes.length || pasteSaving) return;
    const projectId = newProjectId || baseProjectId;
    setPasteSaving(true);
    setPasteError("");
    try {
      const startOrder = tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId).length;
      await createBulkNodes(nodes, projectId, "", null, startOrder);
      setPasteText("");
      setPasteOpen(false);
    } catch (reason) {
      setPasteError(reason instanceof Error ? reason.message : "Could not paste those items.");
    } finally {
      setPasteSaving(false);
    }
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
    try {
      await Promise.all(selectedBulkIds.map((id) => onUpdateTask(id, patch)));
      setSelectedBulkIds([]);
      setKanbanError("");
    } catch (reason) {
      setKanbanError(reason instanceof Error ? reason.message : "Bulk update failed.");
    }
  };

  const projectSprints = sprints.filter((sprint) => !activeProject || sprint.projectId === activeProject.id);

  const persistKanbanMove = async (result: DropResult) => {
    if (!result.destination) return;
    const item = tasks.find((candidate) => candidate.id === result.draggableId);
    if (!item) return;
    const previous = { status: item.status, order: item.order, rank: item.rank };
    const nextStatus = statusForKanbanColumn(result.destination.droppableId, item.status);
    try {
      await onUpdateTask(item.id, {
        status: nextStatus,
        order: result.destination.index,
        rank: result.destination.index,
      });
      setKanbanError("");
    } catch (reason) {
      await onUpdateTask(item.id, previous);
      setKanbanError(reason instanceof Error ? reason.message : "The card could not be moved.");
    }
  };

  const toggleBulk = (id: string) => {
    setSelectedBulkIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleDone = (item: any) => {
    const isDone = canonicalStatus(item) === "done";
    onUpdateTask(item.id, {
      status: isDone ? "backlog" : "done",
      completedAt: isDone ? null : new Date().toISOString(),
    });
  };

  const renderRow = (item: any, peers: any[]) => {
    const kind = workItemKind(item);
    const children = tasks.filter((candidate) => parentId(candidate) === item.id);
    const isDone = canonicalStatus(item) === "done";
    return (
      <article
        className={`do-items-row is-${kind} ${isDone ? "is-done" : ""} ${selectedItemId === item.id ? "is-selected" : ""} ${draggedItemId === item.id ? "is-dragging" : ""} ${dragOverItemId === item.id ? "is-drag-over" : ""}`}
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
        <button aria-label={`${isDone ? "Reopen" : "Mark done"} ${title(item)}`} className={`do-items-check ${isDone ? "is-done" : ""}`} onClick={() => toggleDone(item)} title={isDone ? "Reopen item" : "Mark item done"} type="button">
          {isDone ? <Check size={12} /> : <Circle size={12} />}
        </button>
        <button aria-label={`Select ${title(item)} for bulk editing`} className={`do-items-select ${selectedBulkIds.includes(item.id) ? "is-selected" : ""}`} onClick={() => toggleBulk(item.id)} title="Select for bulk editing" type="button">
          {selectedBulkIds.includes(item.id) ? <Check size={11} /> : <Square size={11} />}
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
        {itemColumnSet.has("title") && (
          <div className="do-items-title">
            <button
              aria-label={`${workItemLabel(kind)} ${title(item)}`}
              className={`do-items-type-flag is-${kind}`}
              data-testid="item-type-flag"
              onClick={() => onSelectItem(item.id)}
              type="button"
            >
              {workItemLabel(kind)}
            </button>
            <InlineText ariaLabel={`Title for ${title(item)}`} onCommit={(next) => next && onUpdateTask(item.id, { title: next })} value={title(item)} />
            {children.length ? <small>{children.length}</small> : null}
          </div>
        )}
        {itemColumnSet.has("project") && (
          <select
            aria-label={`Project for ${title(item)}`}
            onChange={(event) => onUpdateTask(item.id, { projectId: event.target.value || null })}
            value={item.projectId || ""}
          >
            <option value="">No project / errand</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{projectTitle(project)}</option>
            ))}
          </select>
        )}
        {itemColumnSet.has("delivery_entity") && <ControlledSelect ariaLabel={`Delivery Entity for ${title(item)}`} onAddOption={(name) => onCreateControlledOption?.("delivery_entity", name)} onChange={(next) => onUpdateTask(item.id, { deliveryEntity: next || "Internal", bpo: next || "Internal" })} options={deliveryEntityOptions} value={deliveryEntity(item, projects)} />}
        {itemColumnSet.has("client_entity") && <ControlledSelect ariaLabel={`Client Entity for ${title(item)}`} onAddOption={(name) => onCreateControlledOption?.("client_entity", name)} onChange={(next) => onUpdateTask(item.id, { clientEntity: next || "Internal", client: next || "Internal" })} options={clientEntityOptions} value={clientEntity(item, projects)} />}
        {itemColumnSet.has("tags") && <CompactTagPicker label={`Tags for ${title(item)}`} onCreateTag={(name) => onCreateControlledOption?.("tag", name)} onChange={(patch) => onUpdateTask(item.id, patch)} record={item} tags={tags} />}
        {itemColumnSet.has("work_category") && <select aria-label={`Work Category for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { workCategory: event.target.value })} value={itemWorkCategory(item, projects)}>
          {WORK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>}
        {itemColumnSet.has("product_phase") && <select aria-label={`Product Phase for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { productPhase: event.target.value })} value={itemProductPhase(item, projects)}>
          {PRODUCT_PHASES.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
        </select>}
        {itemColumnSet.has("status") && <select aria-label={`Status for ${title(item)}`} className={`do-items-status-pill is-${canonicalStatus(item)}`} onChange={(event) => onUpdateTask(item.id, { status: event.target.value })} value={canonicalStatus(item)}>
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
        {itemColumnSet.has("sprint") && (
          <select
            aria-label={`Sprint for ${title(item)}`}
            onChange={(event) => onUpdateTask(item.id, { sprintId: event.target.value || null })}
            value={item.sprintId || ""}
          >
            <option value="">No sprint</option>
            {sprints
              .filter((sprint) => !item.projectId || sprint.projectId === item.projectId)
              .map((sprint) => (
                <option key={sprint.id} value={sprint.id}>{sprint.name || "Sprint"}</option>
              ))}
          </select>
        )}
      </article>
    );
  };

  const startColumnResize = (column: ItemColumnKey, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = itemColumnPixels[column] || defaultItemColumnPixels[column];
    handle.setPointerCapture(event.pointerId);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (move: PointerEvent) => {
      move.preventDefault();
      updateItemColumnWidth(column, startWidth + (move.clientX - startX));
    };
    const onUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  const renderColumnHeader = () => (
    <div className="do-items-column-head" style={itemGridStyle}>
      <span />
      <span />
      <span />
      {[...itemColumnSet].map((column) => (
        <strong key={column}>
          {itemColumnLabels[column]}
          <span
            aria-label={`Resize ${itemColumnLabels[column]} column`}
            className="do-items-col-resizer"
            data-testid="item-column-resizer"
            onPointerDown={(event) => startColumnResize(column, event)}
            role="separator"
          />
        </strong>
      ))}
    </div>
  );

  const toggleGroup = (group: string) => {
    setCollapsedGroups((current) => current.includes(group)
      ? current.filter((item) => item !== group)
      : [...current, group]);
  };

  const renderSectionHead = (item: any, groupKey: string, childCount: number) => {
    const kind = workItemKind(item);
    const collapsed = collapsedGroups.includes(groupKey);
    return (
      <header className={`do-items-section-head is-${kind}`} data-testid="item-section-head">
        <button
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${title(item)}`}
          className="do-items-section-toggle"
          onClick={() => toggleGroup(groupKey)}
          type="button"
        >
          <ChevronDown className={collapsed ? "is-collapsed" : ""} size={14} />
        </button>
        <button
          aria-label={`${workItemLabel(kind)} ${title(item)}`}
          className={`do-items-type-flag is-${kind}`}
          data-testid="item-type-flag"
          onClick={() => onSelectItem(item.id)}
          type="button"
        >
          {workItemLabel(kind)}
        </button>
        <h3>
          <button onClick={() => onSelectItem(item.id)} type="button">
            {title(item)}
          </button>
        </h3>
        {childCount ? <small>{childCount}</small> : null}
      </header>
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
          const groupKey = `epic:${epic.id}`;
          const collapsed = collapsedGroups.includes(groupKey);
          const epicFeatures = features.filter((feature) => parentId(feature) === epic.id || feature.epicId === epic.id);
          const epicExecutables = executables.filter((item) => (parentId(item) === epic.id || item.epicId === epic.id) && !item.featureId);
          return (
            <section className="do-items-parent is-epic-section" key={epic.id}>
              {renderSectionHead(epic, groupKey, epicFeatures.length + epicExecutables.length)}
              {collapsed ? null : (
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
              )}
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
        {orphanExecutables.length > 0 && (
          <section className="do-items-parent is-orphan">
            <header className="do-items-section-head">
              <h3>Unassigned</h3>
              <small>{orphanExecutables.length}</small>
            </header>
            {orphanExecutables.map((item) => renderRow(item, orphanExecutables))}
          </section>
        )}
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
      if (groupBy === "work_category") return itemWorkCategory(item, projects);
      if (groupBy === "product_phase") return itemProductPhase(item, projects);
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

  const renderBoardCard = (item: any) => {
    const kind = workItemKind(item);
    const due = dateInputValue(item.dueDate || item.targetDate);
    return (
      <article className={`do-kanban-card is-${kind} ${selectedItemId === item.id ? "is-selected" : ""}`} key={item.id}>
        <button className="do-kanban-card-title" onClick={() => onSelectItem(item.id)} type="button">
          <span className={`do-items-type-flag is-${kind}`} data-testid="item-type-flag">{workItemLabel(kind)}</span>
          <strong>{title(item)}</strong>
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
    const useDeliveryBoard = Boolean(activeProject) || groupBy === "hierarchy" || groupBy === "status";
    const columns = useDeliveryBoard && groupBy !== "actionBoard"
      ? KANBAN_COLUMNS.map((column) => ({
          key: column.key,
          title: column.label,
          items: filtered.filter((item) => kanbanColumnForStatus(canonicalStatus(item)) === column.key),
        }))
      : Object.entries(grouped)
        .map(([key, items]) => ({ key, title: displayStatus(key) === key ? key : key, items }))
        .sort((left, right) => {
          const leftIndex = groupSortIndex(groupBy, left.key);
          const rightIndex = groupSortIndex(groupBy, right.key);
          if (leftIndex !== rightIndex) return leftIndex - rightIndex;
          return left.title.localeCompare(right.title);
        });
    const visibleColumns = columns.filter((column) => column.items.length > 0 || (useDeliveryBoard && groupBy !== "actionBoard"));

    return (
      <DragDropContext onDragEnd={(result) => void persistKanbanMove(result)}>
        {kanbanError && <p className="do-signin-error" role="alert">{kanbanError}</p>}
        <div className={`do-kanban-board ${groupBy === "actionBoard" ? "is-action-board" : "is-dynamic-board"}`}>
          {visibleColumns.map((column) => (
            <Droppable droppableId={column.key} key={column.key}>
              {(provided) => (
                <section className="do-kanban-column" ref={provided.innerRef} {...provided.droppableProps}>
                  <header>
                    <strong>{column.title}</strong>
                    <span>{column.items.length}</span>
                  </header>
                  <div>
                    {column.items.map((item, index) => (
                      <Draggable draggableId={item.id} index={index} key={item.id}>
                        {(drag) => (
                          <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                            {renderBoardCard(item)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {column.items.length === 0 && <p>No items</p>}
                  </div>
                </section>
              )}
            </Droppable>
          ))}
          {filtered.length === 0 && <div className="do-items-empty"><ListChecks size={21} /><strong>No items match the current filters.</strong><span>Clear a filter or create the next item.</span></div>}
        </div>
      </DragDropContext>
    );
  };

  const renderGantt = (items = filtered) => {
    const dated = items
      .map((item) => {
        const start = ganttDate(item);
        const explicitEnd = ganttDate({ dueDate: item.dueDate || item.targetDate || item.endDate || item.plannedEndDate });
        const end = explicitEnd || (start ? ganttDate(item, 3) : null);
        return { item, start, end };
      })
      .filter((entry) => entry.start && entry.end) as Array<{ item: any; start: Date; end: Date }>;
    const undated = items.filter((item) => !ganttDate(item));
    const now = Date.now();
    const spanDays = ganttScale === "week" ? 7 : 31;
    const minTime = dated.length ? Math.min(...dated.map((entry) => entry.start.getTime()), now) : now;
    const maxTime = dated.length
      ? Math.max(...dated.map((entry) => entry.end.getTime()), minTime + spanDays * 86_400_000)
      : now + spanDays * 86_400_000;
    const span = Math.max(1, maxTime - minTime);
    const markers = Array.from({ length: 5 }, (_, index) => new Date(minTime + (span * index) / 4));
    const todayLeft = ((now - minTime) / span) * 100;

    return (
      <div className="do-gantt">
        <div className="do-gantt-scale">
          <button className={ganttScale === "week" ? "is-active" : ""} onClick={() => setGanttScale("week")} type="button">Week</button>
          <button className={ganttScale === "month" ? "is-active" : ""} onClick={() => setGanttScale("month")} type="button">Month</button>
        </div>
        <div className="do-gantt-axis">
          {markers.map((marker) => <span key={marker.toISOString()}>{dateLabel(marker)}</span>)}
        </div>
        <div className="do-gantt-rows">
          <div className="do-gantt-today" style={{ left: `${Math.max(0, Math.min(100, todayLeft))}%` }} title="Today" />
          {dated.map(({ item, start, end }) => {
            const kind = workItemKind(item);
            const left = ((start.getTime() - minTime) / span) * 100;
            const width = Math.max(4, ((end.getTime() - start.getTime()) / span) * 100);
            const tone = taskDueStatus({ status: item.status, dueDate: end });
            return (
              <article className={`do-gantt-row is-${tone}`} key={item.id}>
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

  const activeFilterChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (projectFilter !== "all" && !activeProject) {
    activeFilterChips.push({
      key: "project",
      label:
        projectFilter === "no_project"
          ? "No project"
          : projectTitle(projects.find((p) => p.id === projectFilter) || { title: "Project" }),
      clear: () => setProjectFilter("all"),
    });
  }
  if (statusFilter !== "open") {
    activeFilterChips.push({
      key: "status",
      label: statusFilter === "all" ? "All statuses" : displayStatus(statusFilter),
      clear: () => setStatusFilter("open"),
    });
  }
  if (priorityFilter !== "all") {
    activeFilterChips.push({
      key: "priority",
      label: `Priority ${priorityFilter}`,
      clear: () => setPriorityFilter("all"),
    });
  }
  if (typeFilter !== "all") {
    activeFilterChips.push({
      key: "type",
      label: workItemLabel(typeFilter as WorkItemKind),
      clear: () => setTypeFilter("all"),
    });
  }
  if (ownerFilter !== "all") {
    activeFilterChips.push({ key: "owner", label: ownerFilter, clear: () => setOwnerFilter("all") });
  }
  if (dateFilter !== "all") {
    activeFilterChips.push({
      key: "date",
      label: dueBucketLabels[dateFilter as keyof typeof dueBucketLabels] || dateFilter,
      clear: () => setDateFilter("all"),
    });
  }
  if (tagFilter !== "all") {
    activeFilterChips.push({
      key: "tag",
      label: tags.find((tag) => tag.id === tagFilter)?.name || "Tag",
      clear: () => setTagFilter("all"),
    });
  }
  if (workCategoryFilter !== "all") {
    activeFilterChips.push({
      key: "category",
      label: workCategoryFilter,
      clear: () => setWorkCategoryFilter("all"),
    });
  }
  if (productPhaseFilter !== "all") {
    activeFilterChips.push({
      key: "phase",
      label: productPhaseFilter,
      clear: () => setProductPhaseFilter("all"),
    });
  }
  if (sprintFilter !== "all") {
    activeFilterChips.push({
      key: "sprint",
      label:
        sprintFilter === "none"
          ? "No sprint"
          : projectSprints.find((sprint) => sprint.id === sprintFilter)?.name || "Sprint",
      clear: () => setSprintFilter("all"),
    });
  }

  const blockedCount = filtered.filter((item) => canonicalStatus(item) === "blocked").length;
  const priorityOneCount = filtered.filter((item) => priorityValue(item.priority) === "1").length;
  const overdueCount = filtered.filter(
    (item) => dueBucket(item.dueDate || item.targetDate) === "overdue",
  ).length;
  const summaryHasSignal = blockedCount + priorityOneCount + overdueCount > 0;

  return (
    <div className={`do-items-center ${chromeCollapsed ? "is-focus" : ""} ${compact ? "is-compact" : ""}`} data-testid="work-items-center">
      <section className={`do-items-toolbar ${chromeCollapsed ? "is-compact" : ""}`}>
        {!chromeCollapsed && (
          <label className="do-items-search">
            <Search size={14} />
            <input aria-label="Search work items" onChange={(event) => setQuery(event.target.value)} placeholder="Search items…" value={query} />
          </label>
        )}
        <datalist id="do-workspace-member-options">
          {owners.map((owner) => <option key={owner} value={owner} />)}
        </datalist>
        <div className="do-items-mode" aria-label="Work item view">
          <button aria-label="List view" className={mode === "list" ? "is-active" : ""} onClick={() => setMode("list")} type="button"><ListChecks size={14} /> List</button>
          <button aria-label="Kanban view" className={`do-mobile-advanced ${mode === "kanban" ? "is-active" : ""}`} onClick={() => { setMode("kanban"); setGroupBy("hierarchy"); }} type="button"><Kanban size={14} /> Kanban</button>
          <button aria-label="Gantt view" className={`do-mobile-advanced ${mode === "gantt" ? "is-active" : ""}`} onClick={() => setMode("gantt")} type="button"><CalendarRange size={14} /> Gantt</button>
          <button aria-label="Epics view" className={`do-mobile-advanced ${mode === "epics" ? "is-active" : ""}`} onClick={() => setMode("epics")} type="button">Epics</button>
        </div>
        <div className="do-items-toolbar-actions">
          <div className="do-popover-anchor">
            <button aria-expanded={viewsOpen} aria-label="Views" className={`do-mobile-advanced ${viewsOpen ? "is-active" : ""}`} onClick={() => { setViewsOpen((o) => !o); setFilterOpen(false); setSortOpen(false); setFieldsOpen(false); }} type="button">Views</button>
            {viewsOpen && (
              <div className="do-popover do-items-views-popover" role="menu">
                <button onClick={() => { setGroupBy("actionBoard"); setPrimarySort("priority"); setSecondarySort("due"); setMode("kanban"); setViewsOpen(false); }} type="button">Action Board</button>
                <button onClick={() => { setGroupBy("project"); setPrimarySort("project"); setSecondarySort("priority"); setViewsOpen(false); }} type="button">Project → priority</button>
                <button onClick={() => { setGroupBy("priority"); setPrimarySort("priority"); setSecondarySort("due"); setViewsOpen(false); }} type="button">Priority → date</button>
                <button onClick={() => { setGroupBy("priority"); setPrimarySort("priority"); setSecondarySort("project"); setViewsOpen(false); }} type="button">Priority → project</button>
                {savedItemViews.length > 0 && (
                  <>
                    <strong className="do-items-views-label">Saved views</strong>
                    {savedItemViews.map((saved) => (
                      <div className="do-items-saved-view" key={saved.name}>
                        <button onClick={() => applyItemView(saved.name)} type="button">{saved.name}</button>
                        <button aria-label={`Delete ${saved.name} view`} onClick={() => deleteItemView(saved.name)} type="button">Delete</button>
                      </div>
                    ))}
                  </>
                )}
                <form
                  className="do-items-save-view"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveItemView();
                  }}
                >
                  <label>
                    Name and save this view
                    <input
                      aria-label="Saved view name"
                      data-testid="item-view-name"
                      onChange={(event) => {
                        setItemViewName(event.target.value);
                        setViewSaveError("");
                        setViewSaveNotice("");
                      }}
                      placeholder="Backlog grooming"
                      value={itemViewName}
                    />
                  </label>
                  {viewSaveError ? <p className="do-items-view-error">{viewSaveError}</p> : null}
                  {viewSaveNotice ? <p className="do-items-view-notice">{viewSaveNotice}</p> : null}
                  <button data-testid="item-save-view" type="submit">Save view</button>
                </form>
                <button onClick={resetItemColumnWidths} type="button">Reset column widths</button>
                <button
                  onClick={() =>
                    visibleItemColumns.forEach((column) =>
                      updateItemColumnWidth(
                        column,
                        defaultItemColumnPixels[column],
                      ),
                    )
                  }
                  type="button"
                >
                  Apply default widths
                </button>
              </div>
            )}
          </div>
          <div className="do-popover-anchor">
            <button
              aria-expanded={fieldsOpen}
              aria-label="Fields"
              className={`do-mobile-advanced ${fieldsOpen ? "is-active" : ""}`}
              data-testid="item-fields-button"
              onClick={() => { setFieldsOpen((o) => !o); setViewsOpen(false); setFilterOpen(false); setSortOpen(false); }}
              type="button"
            >
              Fields
            </button>
            {fieldsOpen && (
              <div className="do-popover do-fields-popover" data-testid="item-fields-picker" role="menu">
                <strong>Item fields</strong>
                <span>Show or add the same fields used in project backlog items.</span>
                <div className="do-column-picker">
                  {selectableItemColumns().map((column) => (
                    <label key={column} className="do-column-toggle">
                      <input
                        aria-label={`${visibleItemColumns.includes(column) ? "Hide" : "Show"} ${itemColumnLabels[column]} field`}
                        checked={visibleItemColumns.includes(column)}
                        onChange={() => toggleItemColumn(column)}
                        type="checkbox"
                      />
                      {itemColumnLabels[column]}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="do-popover-anchor">
            <button aria-expanded={filterOpen} aria-label="Filter" className={activeFilterChips.length ? "is-active" : ""} onClick={() => { setFilterOpen((o) => !o); setSortOpen(false); setViewsOpen(false); setFieldsOpen(false); }} type="button">
              <SlidersHorizontal size={13} /> Filter{activeFilterChips.length > 0 && <em>{activeFilterChips.length}</em>}
            </button>
            {filterOpen && (
              <div className="do-popover do-filter-popover">
                <label>
                  Add filter
                  <select aria-label="Filter field" onChange={(event) => setFilterDraft(event.target.value)} value={filterDraft}>
                    <option value="project">Project</option>
                    <option value="status">Status</option>
                    <option value="priority">Priority</option>
                    <option value="type">Type</option>
                    <option value="owner">Owner</option>
                    <option value="date">Date</option>
                    <option value="tag">Tag</option>
                    <option value="category">Category</option>
                    <option value="phase">Product phase</option>
                    <option value="sprint">Sprint</option>
                  </select>
                </label>
                {filterDraft === "project" && (
                  <select aria-label="Project filter" onChange={(event) => setProjectFilter(event.target.value)} value={projectFilter}>
                    <option value="all">All projects</option>
                    <option value="no_project">No project / errands</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{projectTitle(project)}</option>)}
                  </select>
                )}
                {filterDraft === "status" && (
                  <select aria-label="Status filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                    <option value="open">Open · hide done</option>
                    <option value="all">All statuses</option>
                    {workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}
                  </select>
                )}
                {filterDraft === "priority" && (
                  <select aria-label="Priority filter" onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}>
                    <option value="all">Any priority</option>
                    {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                )}
                {filterDraft === "type" && (
                  <select aria-label="Type filter" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                    <option value="all">Any type</option>
                    {workTypes.map((kind) => <option key={kind} value={kind}>{workItemLabel(kind)}</option>)}
                  </select>
                )}
                {filterDraft === "owner" && (
                  <select aria-label="Owner filter" onChange={(event) => setOwnerFilter(event.target.value)} value={ownerFilter}>
                    <option value="all">Any owner</option>
                    {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                )}
                {filterDraft === "date" && (
                  <select aria-label="Date filter" onChange={(event) => setDateFilter(event.target.value)} value={dateFilter}>
                    <option value="all">Any date</option>
                    {dueFilterOptions.map((option) => <option key={option} value={option}>{dueBucketLabels[option]}</option>)}
                  </select>
                )}
                {filterDraft === "tag" && (
                  <select aria-label="Tag filter" onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
                    <option value="all">Any tag</option>
                    {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name || tag.id}</option>)}
                  </select>
                )}
                {filterDraft === "category" && (
                  <select aria-label="Work Category filter" onChange={(event) => setWorkCategoryFilter(event.target.value)} value={workCategoryFilter}>
                    <option value="all">Any category</option>
                    {WORK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                )}
                {filterDraft === "phase" && (
                  <select aria-label="Product Phase filter" onChange={(event) => setProductPhaseFilter(event.target.value)} value={productPhaseFilter}>
                    <option value="all">Any product phase</option>
                    {PRODUCT_PHASES.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
                  </select>
                )}
                {filterDraft === "sprint" && (
                  <select aria-label="Sprint filter" onChange={(event) => setSprintFilter(event.target.value)} value={sprintFilter}>
                    <option value="all">All sprints</option>
                    <option value="none">No sprint</option>
                    {projectSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name || "Sprint"}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>
          <div className="do-popover-anchor">
            <button aria-expanded={sortOpen} aria-label="Sort" className="do-mobile-advanced" onClick={() => { setSortOpen((o) => !o); setFilterOpen(false); setViewsOpen(false); setFieldsOpen(false); }} type="button">Sort</button>
            {sortOpen && (
              <div className="do-popover">
                <label>Group by<select aria-label="Group by" onChange={(event) => setGroupBy(event.target.value as GroupBy)} value={groupBy}><option value="hierarchy">Hierarchy</option><option value="actionBoard">Action Board</option><option value="status">Status</option><option value="priority">Priority</option><option value="project">Project</option><option value="owner">Owner</option><option value="type">Type</option><option value="work_category">Work Category</option><option value="product_phase">Product Phase</option><option value="tag">Tag</option><option value="due">Due date</option></select></label>
                <label>Primary sort<select aria-label="Primary sort" onChange={(event) => setPrimarySort(event.target.value as SortBy)} value={primarySort}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label>Then sort<select aria-label="Secondary sort" onChange={(event) => setSecondarySort(event.target.value as SortBy)} value={secondarySort}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>
            )}
          </div>
          <button aria-label="Add item" className="do-button do-button-dark" onClick={() => setAddItemOpen((o) => !o)} type="button"><Plus size={13} /> Add item</button>
          <button
            aria-label="Paste bulk items"
            className="do-button-secondary do-mobile-advanced"
            onClick={() => { setPasteOpen(true); setPasteError(""); }}
            type="button"
          >
            <Clipboard size={13} /> Paste bulk items
          </button>
          {onCreateSprint && (
            <button aria-label="Add sprint" className="do-button-secondary do-mobile-advanced" onClick={() => setAddSprintOpen((o) => !o)} type="button">+ Sprint</button>
          )}
          <button aria-label={chromeCollapsed ? "Show controls" : "Focus list"} className="do-items-focus-toggle" onClick={() => setChromeCollapsed((c) => !c)} title={chromeCollapsed ? "Show controls" : "Focus list"} type="button"><SlidersHorizontal size={13} /></button>
        </div>
      </section>

      {activeFilterChips.length > 0 && (
        <div className="do-filter-chips" aria-label="Active filters">
          {activeFilterChips.map((chip) => (
            <button key={chip.key} onClick={chip.clear} type="button">{chip.label} <X size={12} /></button>
          ))}
          <button className="is-text" onClick={() => { if (!activeProject) setProjectFilter("all"); setStatusFilter("open"); setPriorityFilter("all"); setTypeFilter("all"); setOwnerFilter("all"); setDateFilter("all"); setTagFilter("all"); setWorkCategoryFilter("all"); setProductPhaseFilter("all"); setSprintFilter("all"); }} type="button">Clear all</button>
        </div>
      )}

      {addItemOpen && (
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
      )}
      {addSprintOpen && onCreateSprint && (
        <section className="do-items-create">
          {!activeProject && (
            <select aria-label="New sprint project" onChange={(event) => setNewProjectId(event.target.value)} value={newProjectId}>
              <option value="">Choose project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{projectTitle(project)}</option>)}
            </select>
          )}
          <input aria-label="New sprint name" onChange={(event) => setSprintName(event.target.value)} placeholder="Sprint name" value={sprintName} />
          <button
            disabled={!sprintName.trim() || !(activeProject?.id || newProjectId)}
            onClick={async () => {
              const projectId = activeProject?.id || newProjectId;
              if (!projectId) return;
              await onCreateSprint({ name: sprintName.trim(), projectId, status: "planning" });
              setSprintName("");
              setAddSprintOpen(false);
            }}
            type="button"
          >
            <Plus size={13} /> Create sprint
          </button>
        </section>
      )}

      {pasteOpen && (
        <div aria-label="Paste bulk items" aria-modal="true" className="do-skill-layer" role="dialog">
          <section className="do-skill-modal do-paste-modal">
            <header className="do-skill-head">
              <div className="do-skill-title">
                <span><Clipboard size={18} /></span>
                <div>
                  <small>{activeProject ? projectTitle(activeProject) : "My Work"}</small>
                  <h2>Paste bulk items</h2>
                  <p>
                    Each line becomes a PBI{activeProject ? " on this project" : " as a general item"}.
                    Indent with Tab (or two spaces) to create a subtask under the line above.
                  </p>
                </div>
              </div>
              <button aria-label="Close paste bulk items" onClick={() => setPasteOpen(false)} type="button"><X size={18} /></button>
            </header>
            <div className="do-skill-body">
              <label className="do-skill-field">
                <span>Item list</span>
                <textarea
                  aria-label="Bulk item list"
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder={"Launch checkout\n\tMap payment errors\n\tWrite retry copy\nPilot store"}
                  value={pasteText}
                />
                <small>
                  {pasteCounts.pbis} PBI{pasteCounts.pbis === 1 ? "" : "s"}
                  {pasteCounts.subtasks ? ` · ${pasteCounts.subtasks} subtask${pasteCounts.subtasks === 1 ? "" : "s"}` : ""}
                  {activeProject ? ` · ${projectTitle(activeProject)}` : " · general items"}
                </small>
              </label>
              {pasteError && <p className="do-skill-error">{pasteError}</p>}
            </div>
            <footer className="do-skill-foot">
              <span>Paste from a doc, chat, or spreadsheet. Tabs keep the hierarchy.</span>
              <div>
                <button onClick={() => setPasteOpen(false)} type="button">Cancel</button>
                <button
                  className="do-skill-create"
                  disabled={!pasteTree.length || pasteSaving}
                  onClick={createBulkItems}
                  type="button"
                >
                  {pasteSaving ? "Adding..." : "Add items"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {selectedBulkIds.length > 0 && (
        <section className="do-items-bulk do-mobile-advanced" aria-label="Bulk actions">
          <span><SlidersHorizontal size={13} /> {selectedBulkIds.length} selected</span>
          <select aria-label="Bulk status" onChange={(event) => setBulkStatus(event.target.value)} value={bulkStatus}>{workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select>
          <button onClick={() => updateBulk({ status: bulkStatus })} type="button">Apply status</button>
          <select aria-label="Bulk priority" onChange={(event) => setBulkPriority(event.target.value)} value={bulkPriority}>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
          <button onClick={() => updateBulk({ priority: bulkPriority === "N/A" ? null : bulkPriority })} type="button">Apply priority</button>
          <input aria-label="Bulk due date" onChange={(event) => setBulkDueDate(event.target.value)} type="date" value={bulkDueDate} />
          <button onClick={() => updateBulk({ dueDate: bulkDueDate || null })} type="button">Apply date</button>
          <select aria-label="Bulk assignee" onChange={(event) => setBulkAssigneeId(event.target.value)} value={bulkAssigneeId}>
            <option value="">Assignee</option>
            {workspaceMembers.filter((member) => String(member.status || "active") !== "removed").map((member) => (
              <option key={member.id} value={member.id}>{memberName(member)}</option>
            ))}
          </select>
          <button
            disabled={!bulkAssigneeId}
            onClick={() => {
              const member = workspaceMembers.find((item) => item.id === bulkAssigneeId);
              updateBulk({
                assigneeIds: member ? [member.id] : [],
                assignees: member ? [memberName(member)] : [],
                owner: member ? memberName(member) : "",
                assignee: member ? memberName(member) : "",
              });
            }}
            type="button"
          >
            Assign
          </button>
          {onCreateSprint && (
            <>
              <select aria-label="Bulk sprint" onChange={(event) => setBulkSprintId(event.target.value)} value={bulkSprintId}>
                <option value="">Sprint</option>
                <option value="none">Remove sprint</option>
                {projectSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name || "Sprint"}</option>)}
              </select>
              <button disabled={!bulkSprintId} onClick={() => updateBulk({ sprintId: bulkSprintId === "none" ? null : bulkSprintId })} type="button">Apply sprint</button>
            </>
          )}
          <select aria-label="Bulk project" onChange={(event) => setBulkProjectId(event.target.value)} value={bulkProjectId}>
            <option value="">Project</option>
            <option value="none">Remove from project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title || project.name}</option>)}
          </select>
          <button disabled={!bulkProjectId} onClick={() => updateBulk({ projectId: bulkProjectId === "none" ? null : bulkProjectId })} type="button">Apply project</button>
          <select aria-label="Share item with colleague" onChange={(event) => setBulkShareId(event.target.value)} value={bulkShareId}>
            <option value="">Share with</option>
            {workspaceMembers.filter((member) => String(member.status || "active") !== "removed").map((member) => (
              <option key={`share-${member.id}`} value={member.id}>{memberName(member)}</option>
            ))}
          </select>
          <button
            disabled={!bulkShareId}
            onClick={() => Promise.all(selectedBulkIds.map((id) => {
              const item = tasks.find((task) => task.id === id);
              const member = workspaceMembers.find((candidate) => candidate.id === bulkShareId);
              if (!item || !member) return Promise.resolve();
              const grant = collaborationShareGrant(member);
              return onUpdateTask(id, withCollaboratorAccess(item, grant));
            }))}
            type="button"
          >
            Share item
          </button>
          <button onClick={() => updateBulk({ status: "archived" })} type="button">Archive</button>
        </section>
      )}

      <div className={`do-items-layout ${selectedItem ? "has-detail" : ""}`}>
        <section className={`do-items-workspace is-${mode}`}>
          <div className="do-items-summary">
            {(summaryHasSignal || filtered.length > 0) && (
              <span>
                <strong>{filtered.length}</strong> shown
                {summaryHasSignal && (
                  <>
                    {" · "}
                    {blockedCount > 0 && <><strong>{blockedCount}</strong> blocked </>}
                    {priorityOneCount > 0 && <><strong>{priorityOneCount}</strong> P1 </>}
                    {overdueCount > 0 && <><strong>{overdueCount}</strong> overdue</>}
                  </>
                )}
              </span>
            )}
          </div>
          {mode === "list" && renderColumnHeader()}
          {mode === "gantt" ? renderGantt() : mode === "epics" ? renderGantt(filtered.filter((item) => workItemKind(item) === "epic")) : mode === "kanban" ? renderKanban() : groupBy === "hierarchy" ? renderHierarchy() : (
            <div className="do-items-groups">
              {Object.entries(grouped).sort(([left], [right]) => {
                const leftIndex = groupSortIndex(groupBy, left);
                const rightIndex = groupSortIndex(groupBy, right);
                if (leftIndex !== rightIndex) return leftIndex - rightIndex;
                return left.localeCompare(right);
              }).map(([group, items]) => (
                <section className="do-items-group" key={group}>
                  <button className="do-items-section-head" onClick={() => toggleGroup(group)} type="button"><ChevronDown className={collapsedGroups.includes(group) ? "is-collapsed" : ""} size={13} /><strong>{group}</strong><span>{items.length}</span></button>
                  {!collapsedGroups.includes(group) && <div>{items.map((item) => renderRow(item, items))}</div>}
                </section>
              ))}
              {filtered.length === 0 && (
                <div className="do-items-empty">
                  <ListChecks size={24} />
                  <strong>No items here yet</strong>
                  <span>Create the first item to start this backlog.</span>
                  <button
                    className="do-button do-button-dark"
                    onClick={() => setAddItemOpen(true)}
                    type="button"
                  >
                    Create first item
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {selectedItem && (
          <aside className="do-item-detail" aria-label="Selected work item detail">
            <div className="do-item-detail-head">
              <span>{workItemLabel(workItemKind(selectedItem))}</span>
              <button aria-label="Close item detail" className="do-icon-button" onClick={() => onSelectItem(null)} title="Close" type="button"><X size={14} /></button>
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
            <label className="do-mobile-advanced">GTD type<select onChange={(event) => onUpdateTask(selectedItem.id, gtdActionPatch(event.target.value))} value={gtdActionValue(selectedItem)}>{gtdActionTypes.map((type) => <option key={type.value || "none"} value={type.value}>{type.label}</option>)}</select></label>
            <label className="do-mobile-advanced">Action Board bucket<span className="do-item-computed-field">{displayDueBucket(selectedItem)}</span></label>
            <label className="do-mobile-advanced">Delivery Entity<ControlledSelect ariaLabel="Selected item delivery entity" onAddOption={(name) => onCreateControlledOption?.("delivery_entity", name)} onChange={(next) => onUpdateTask(selectedItem.id, { deliveryEntity: next || "Internal", bpo: next || "Internal" })} options={deliveryEntityOptions} value={deliveryEntity(selectedItem, projects)} /></label>
            <label className="do-mobile-advanced">Client Entity<ControlledSelect ariaLabel="Selected item client entity" onAddOption={(name) => onCreateControlledOption?.("client_entity", name)} onChange={(next) => onUpdateTask(selectedItem.id, { clientEntity: next || "Internal", client: next || "Internal" })} options={clientEntityOptions} value={clientEntity(selectedItem, projects)} /></label>
            <label className="do-mobile-advanced">Work Category<select onChange={(event) => onUpdateTask(selectedItem.id, { workCategory: event.target.value })} value={itemWorkCategory(selectedItem, projects)}>{WORK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="do-mobile-advanced">Product Phase<select onChange={(event) => onUpdateTask(selectedItem.id, { productPhase: event.target.value })} value={itemProductPhase(selectedItem, projects)}>{PRODUCT_PHASES.map((phase) => <option key={phase} value={phase}>{phase}</option>)}</select></label>
            <label className="do-mobile-advanced">Tags<CompactTagPicker label="Selected item tags" onCreateTag={(name) => onCreateControlledOption?.("tag", name)} onChange={(patch) => onUpdateTask(selectedItem.id, patch)} record={selectedItem} tags={tags} /></label>
            <label>Assignees <InfoTip label="Item assignees" text="Assign one or many workspace members. The first selected person remains the primary owner for older reports and filters." /></label>
            <MultiAssigneePicker
              label="Item assignees"
              members={workspaceMembers}
              onChange={(assigneeIds, assignees) => onUpdateTask(selectedItem.id, { assigneeIds, assignees, owner: assignees[0] || "", assignee: assignees[0] || "" })}
              selectedIds={Array.isArray(selectedItem.assigneeIds) ? selectedItem.assigneeIds : []}
              selectedNames={Array.isArray(selectedItem.assignees) ? selectedItem.assignees : [selectedItem.owner || selectedItem.assignee].filter(Boolean)}
            />
            <label>Due date<input defaultValue={dateInputValue(selectedItem.dueDate || selectedItem.targetDate)} onBlur={(event) => onUpdateTask(selectedItem.id, { dueDate: event.target.value || null })} type="date" /></label>
            <label className="do-mobile-advanced">Start date<input defaultValue={dateInputValue(selectedItem.startDate)} onBlur={(event) => onUpdateTask(selectedItem.id, { startDate: event.target.value || null })} type="date" /></label>
            <label className="do-mobile-advanced">Sprint<select onChange={(event) => onUpdateTask(selectedItem.id, { sprintId: event.target.value || null })} value={selectedItem.sprintId || ""}><option value="">No sprint</option>{projectSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name || "Sprint"}</option>)}</select></label>
            <label>Project<select onChange={(event) => onUpdateTask(selectedItem.id, { projectId: event.target.value || null })} value={selectedItem.projectId || ""}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title || project.name}</option>)}</select></label>
            <label className="do-mobile-advanced">Parent<select onChange={(event) => onUpdateTask(selectedItem.id, { parentId: event.target.value || null })} value={parentId(selectedItem)}><option value="">No parent</option>{tasks.filter((item) => item.projectId === selectedItem.projectId && item.id !== selectedItem.id).map((item) => <option key={item.id} value={item.id}>{workItemLabel(workItemKind(item))} · {title(item)}</option>)}</select></label>
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
