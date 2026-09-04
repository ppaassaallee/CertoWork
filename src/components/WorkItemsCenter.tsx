import { useEffect, useMemo, useRef, useState, Fragment, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { DragDropContext, Draggable, Droppable, type DragStart, type DropResult } from "@hello-pangea/dnd";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Bookmark,
  Briefcase,
  Bug,
  Calendar,
  CalendarRange,
  Check,
  CheckSquare,
  ChevronDown,
  Circle,
  CircleDot,
  Clipboard,
  Clock,
  Compass,
  CornerDownRight,
  Flag,
  Folder,
  Gem,
  GitBranch,
  Globe,
  GripVertical,
  Inbox,
  Layers,
  LayoutGrid,
  ListChecks,
  ListTodo,
  Kanban,
  Minus,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Square,
  Tag,
  Target,
  Timer,
  Trash,
  User,
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
import { KANBAN_COLUMNS, clampKanbanColumnWidth, DEFAULT_KANBAN_COLUMN_WIDTH, kanbanColumnForStatus, laneForKanbanColumn, statusForKanbanColumn } from "../lib/kanbanBoard";
import {
  KANBAN_SWIMLANES,
  activityThread,
  appendStatusHistory,
  applyKanbanAutomations,
  averageDuration,
  calendarWeekDays,
  canAcceptWipDrop,
  checklistCaption,
  checklistItems,
  checklistProgress,
  commentMentionsViewer,
  cumulativeFlowSeries,
  cycleTimeMs,
  encodeKanbanDroppable,
  extractUrls,
  formatDurationLong,
  itemDueKey,
  itemMentionsViewer,
  leadTimeMs,
  mentionNames,
  mentionSegments,
  newChecklistItem,
  parseKanbanDroppable,
  stackedAreaLayers,
  swimlaneKeyFor,
  swimlaneMovePatch,
  uniqueSwimlanes,
  wipCaption,
  wipTone,
  type KanbanAutomationRule,
  type KanbanComment,
  type KanbanSwimlaneBy,
} from "../lib/kanbanFeatures";
import { heartbeatKanbanPresence, listenKanbanPresence, type KanbanPresence } from "../lib/kanbanPresence";
import { getNextOccurrence } from "../lib/recurrence-utils";
import type { RecurrenceType } from "../types";
import { itemMatchesSprint, type SprintRecord } from "../lib/sprints";
import { CompactTagPicker } from "./CompactTagPicker";
import { countBulkPasteItems, parseBulkPasteItems, type BulkPasteNode } from "../lib/bulkPasteItems";
import {
  allowedChildKinds,
  allowedParentItems,
  allowedParentKinds,
  compareHierarchySiblings,
  effectiveInheritedField,
  effectivePriority,
  hierarchyChildren,
  hierarchyRoot,
  hierarchyRoots,
  isTreeNodeCollapsedState,
  normalizeItemId,
  parentLinkPatch,
  sortHierarchyForest,
  sortHierarchySiblings,
} from "../lib/itemHierarchy";
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

type WorkItemKind = "epic" | "feature" | "pbi" | "story" | "task" | "bug" | "subtask" | "ticket" | "issue";
type GroupBy = ItemGroupBy;
type SortBy = ItemSortBy;

type Props = {
  activeProject: any | null;
  projects: any[];
  /** Items shown in the list (My Work may pass a filtered subset). */
  tasks: any[];
  /** Full item pool for parent assignment. Defaults to `tasks`. */
  hierarchyTasks?: any[];
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
  forceMode?: WorkItemsViewMode;
};

const workTypes: WorkItemKind[] = ["epic", "feature", "pbi", "story", "bug", "task", "subtask", "ticket", "issue"];
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

const ATTR_ICONS: Record<Exclude<ItemColumnKey, "title">, typeof Folder> = {
  project: Folder,
  delivery_entity: Globe,
  client_entity: Briefcase,
  tags: Tag,
  work_category: Layers,
  product_phase: Compass,
  status: CircleDot,
  priority: Flag,
  gtd: ListTodo,
  bucket: Clock,
  assignees: User,
  due: Calendar,
  sprint: Timer,
};

function itemAttributePresent(
  item: any,
  column: Exclude<ItemColumnKey, "title">,
  projects: any[],
  tags: TagLike[],
  allItems: any[] = [],
) {
  if (column === "project") return Boolean(item?.projectId);
  if (column === "delivery_entity") {
    const value = String(effectiveInheritedField(item, allItems, "deliveryEntity") || deliveryEntity(item, projects));
    return Boolean(value) && value !== "Internal";
  }
  if (column === "client_entity") {
    const value = String(effectiveInheritedField(item, allItems, "clientEntity") || clientEntity(item, projects));
    return Boolean(value) && value !== "Internal";
  }
  if (column === "tags") return tagLabels(item, tags).length > 0;
  if (column === "work_category") {
    return Boolean(String(effectiveInheritedField(item, allItems, "workCategory") || item?.workCategory || "").trim());
  }
  if (column === "product_phase") {
    return Boolean(String(effectiveInheritedField(item, allItems, "productPhase") || item?.productPhase || "").trim());
  }
  if (column === "status") return Boolean(canonicalStatus(item));
  if (column === "priority") return priorityValue(effectivePriority(item, allItems)) !== "N/A";
  if (column === "gtd") return Boolean(gtdActionValue(item));
  if (column === "bucket") return displayDueBucket(item) !== "No sector";
  if (column === "assignees") {
    const inherited = effectiveInheritedField(item, allItems, "owner");
    const names = Array.isArray(item?.assignees) ? item.assignees : [item?.owner || item?.assignee || inherited];
    return names.some((name: unknown) => String(name || "").trim());
  }
  if (column === "due") return Boolean(dateInputValue(item?.dueDate || item?.targetDate));
  if (column === "sprint") return Boolean(item?.sprintId);
  return false;
}

function itemAttributeCaption(
  item: any,
  column: Exclude<ItemColumnKey, "title">,
  projects: any[],
  tags: TagLike[],
  sprints: SprintRecord[],
  allItems: any[] = [],
) {
  if (column === "project") return itemProjectTitle(item, projects);
  if (column === "delivery_entity") {
    return String(effectiveInheritedField(item, allItems, "deliveryEntity") || deliveryEntity(item, projects));
  }
  if (column === "client_entity") {
    return String(effectiveInheritedField(item, allItems, "clientEntity") || clientEntity(item, projects));
  }
  if (column === "tags") return tagLabels(item, tags).join(", ") || "No tags";
  if (column === "work_category") {
    return String(effectiveInheritedField(item, allItems, "workCategory") || itemWorkCategory(item, projects));
  }
  if (column === "product_phase") {
    return String(effectiveInheritedField(item, allItems, "productPhase") || itemProductPhase(item, projects));
  }
  if (column === "status") return displayStatus(canonicalStatus(item));
  if (column === "priority") return priorityValue(effectivePriority(item, allItems));
  if (column === "gtd") return gtdActionTypes.find((type) => type.value === gtdActionValue(item))?.label || "GTD: N/A";
  if (column === "bucket") return displayDueBucket(item);
  if (column === "assignees") {
    const inherited = effectiveInheritedField(item, allItems, "owner");
    const names = Array.isArray(item?.assignees) && item.assignees.length
      ? item.assignees
      : [item?.owner || item?.assignee || inherited];
    return names.filter(Boolean).join(", ") || "Unassigned";
  }
  if (column === "due") return dateInputValue(item?.dueDate || item?.targetDate) || "No date";
  if (column === "sprint") {
    const sprint = sprints.find((entry) => entry.id === item?.sprintId);
    return sprint?.name || "No sprint";
  }
  return itemColumnLabels[column];
}

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
  const structuralValue = String(item?.workItemType || item?.taskType || item?.issueType || item?.kind || item?.type || "").toLowerCase();
  const legacyItemType = String(item?.itemType || "").toLowerCase();
  const value = structuralValue || (workTypes.includes(legacyItemType as WorkItemKind) ? legacyItemType : "");
  if (value.includes("epic")) return "epic";
  if (value.includes("feature")) return "feature";
  if (value.includes("subtask") || value.includes("sub_task")) return "subtask";
  if (value.includes("ticket")) return "ticket";
  if (value === "issue" || value.includes("issue")) return "issue";
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

const WORK_ITEM_TYPE_ICONS: Record<WorkItemKind, typeof Gem> = {
  epic: Gem,
  feature: Layers,
  story: Bookmark,
  pbi: Target,
  task: CheckSquare,
  bug: Bug,
  subtask: CornerDownRight,
  ticket: Inbox,
  issue: AlertCircle,
};

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

const CLOSED_STATUSES = new Set(["done", "completed", "closed", "cancelled", "archived", "deleted"]);

function matchesStatusFilter(item: any, statusFilter: string) {
  if (statusFilter === "all") return true;
  if (statusFilter === "open") return !CLOSED_STATUSES.has(String(item?.status || "").toLowerCase());
  return canonicalStatus(item) === statusFilter;
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

const FAMILY_GROUP_BY = new Set<GroupBy>([
  "actionBoard",
  "priority",
  "project",
  "owner",
  "work_category",
  "product_phase",
  "due",
  "tag",
]);

function sortValue(item: any, sortBy: SortBy, projects: any[], allItems: any[] = []) {
  if (sortBy === "project") return itemProjectTitle(item, projects).toLowerCase();
  if (sortBy === "delivery_entity") {
    return String(effectiveInheritedField(item, allItems, "deliveryEntity") || deliveryEntity(item, projects)).toLowerCase();
  }
  if (sortBy === "client_entity") {
    return String(effectiveInheritedField(item, allItems, "clientEntity") || clientEntity(item, projects)).toLowerCase();
  }
  if (sortBy === "work_category") {
    return String(effectiveInheritedField(item, allItems, "workCategory") || itemWorkCategory(item, projects)).toLowerCase();
  }
  if (sortBy === "product_phase") {
    return String(effectiveInheritedField(item, allItems, "productPhase") || itemProductPhase(item, projects)).toLowerCase();
  }
  if (sortBy === "priority") {
    const priority = priorityValue(effectivePriority(item, allItems));
    return priority === "N/A" ? "9" : priority;
  }
  if (sortBy === "due") return dateInputValue(item.dueDate || item.targetDate) || "9999-12-31";
  if (sortBy === "status") return canonicalStatus(item);
  if (sortBy === "owner") {
    return String(effectiveInheritedField(item, allItems, "owner") || item.owner || item.assignee || "zz unassigned").toLowerCase();
  }
  if (sortBy === "type") return workItemKind(item);
  if (sortBy === "title") return title(item).toLowerCase();
  return String(itemOrder(item)).padStart(8, "0");
}

function compareItems(left: any, right: any, primary: SortBy, secondary: SortBy, projects: any[], allItems: any[] = []) {
  const first = sortValue(left, primary, projects, allItems).localeCompare(sortValue(right, primary, projects, allItems));
  if (first) return first;
  const second = primary === secondary
    ? 0
    : sortValue(left, secondary, projects, allItems).localeCompare(sortValue(right, secondary, projects, allItems));
  if (second) return second;
  return compareHierarchySiblings(left, right);
}

function sortItems(items: any[], primary: SortBy, secondary: SortBy, projects: any[], allItems: any[] = items) {
  return sortHierarchyForest(items, (left, right) => compareItems(left, right, primary, secondary, projects, allItems));
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
  onEnter,
}: {
  ariaLabel: string;
  value?: string;
  onCommit: (value: string) => void;
  onEnter?: () => void;
}) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  return (
    <input
      aria-label={ariaLabel}
      onBlur={() => draft.trim() !== String(value || "").trim() && onCommit(draft.trim())}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (draft.trim() !== String(value || "").trim()) onCommit(draft.trim());
        if (onEnter) onEnter();
        else event.currentTarget.blur();
      }}
      value={draft}
    />
  );
}

export function WorkItemsCenter({
  activeProject,
  projects,
  tasks,
  hierarchyTasks,
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
  forceMode,
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
  const [groupBy, setGroupBy] = useState<GroupBy>("hierarchy");
  const [primarySort, setPrimarySort] = useState<SortBy>("project");
  const [secondarySort, setSecondarySort] = useState<SortBy>("priority");
  const [newType, setNewType] = useState<WorkItemKind>("pbi");
  const [newProjectId, setNewProjectId] = useState(activeProject?.id || "");
  const [newParentId, setNewParentId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newPriority, setNewPriority] = useState("N/A");
  const [newDeliveryEntity, setNewDeliveryEntity] = useState("");
  const [inlineAddDrafts, setInlineAddDrafts] = useState<Record<string, string>>({});
  const [inlineAddOpen, setInlineAddOpen] = useState<Record<string, boolean>>({});
  const inlineAddRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  /** Parents the user expanded during this screen visit. Everything else stays collapsed. */
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<string[]>([]);
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
  const [kanbanColumnPixels, setKanbanColumnPixels] = useState<Record<string, number>>({});
  const [kanbanDraftColumn, setKanbanDraftColumn] = useState<string | null>(null);
  const [kanbanDraftTitle, setKanbanDraftTitle] = useState("");
  const [kanbanSwimlane, setKanbanSwimlane] = useState<KanbanSwimlaneBy>("none");
  const [kanbanWipLimits, setKanbanWipLimits] = useState<Record<string, number>>({});
  const [kanbanColumnLabels, setKanbanColumnLabels] = useState<Record<string, string>>({});
  const [kanbanAutomations, setKanbanAutomations] = useState<KanbanAutomationRule[]>([]);
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [checklistDraft, setChecklistDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [bouncingId, setBouncingId] = useState<string | null>(null);
  const bounceTimer = useRef<number | null>(null);
  const [boardViewers, setBoardViewers] = useState<KanbanPresence[]>([]);
  const [openAttr, setOpenAttr] = useState<string | null>(null);
  const [createAttr, setCreateAttr] = useState<string | null>(null);
  const [parentSearch, setParentSearch] = useState("");
  const itemColumnSet = new Set(
    mobileCore ? (["title", "status", "priority", "due"] as ItemColumnKey[]) : visibleItemColumns,
  );
  const attributeColumns = [...itemColumnSet].filter((column): column is Exclude<ItemColumnKey, "title"> => column !== "title");
  const itemGridStyle = {
    gridTemplateColumns: "20px 20px 28px minmax(160px, 1fr) auto 28px",
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
    setKanbanColumnPixels(session?.kanbanWidths || {});
    setKanbanSwimlane(session?.kanbanSwimlane || "none");
    setKanbanWipLimits(session?.kanbanWipLimits || {});
    setKanbanColumnLabels(session?.kanbanColumnLabels || {});
    setKanbanAutomations(session?.kanbanAutomations || []);
    if (forceMode) setMode(forceMode);
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

  const updateKanbanColumnWidth = (columnKey: string, value: number) => {
    setKanbanColumnPixels((current) => ({ ...current, [columnKey]: clampKanbanColumnWidth(value) }));
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
      kanbanWidths: kanbanColumnPixels,
      kanbanSwimlane,
      kanbanWipLimits,
      kanbanColumnLabels,
      kanbanAutomations,
      filters: currentItemViewFilters,
    };
    const next = upsertNamedItemView(savedItemViews, nextView);
    setSavedItemViews(next);
    writeNamedItemViews(viewerId, next);
    persistRemoteMemory(next, writeLastItemSession(viewerId, surface, {
      columns: visibleItemColumns,
      widths: itemColumnPixels,
      kanbanWidths: kanbanColumnPixels,
      kanbanSwimlane,
      kanbanWipLimits,
      kanbanColumnLabels,
      kanbanAutomations,
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
      kanbanWidths: saved.kanbanWidths,
      kanbanSwimlane: saved.kanbanSwimlane,
      kanbanWipLimits: saved.kanbanWipLimits,
      kanbanColumnLabels: saved.kanbanColumnLabels,
      kanbanAutomations: saved.kanbanAutomations,
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
      kanbanWidths: kanbanColumnPixels,
      kanbanSwimlane,
      kanbanWipLimits,
      kanbanColumnLabels,
      kanbanAutomations,
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
    kanbanColumnPixels,
    kanbanSwimlane,
    kanbanWipLimits,
    kanbanColumnLabels,
    kanbanAutomations,
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

  useEffect(() => {
    setCollapsedGroups([]);
    setExpandedTreeNodes([]);
    setInlineAddOpen({});
  }, [groupBy, primarySort, secondarySort, projectFilter, statusFilter, priorityFilter, typeFilter, ownerFilter, dateFilter, tagFilter, workCategoryFilter, productPhaseFilter, query]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("certo-items-focus-list", String(chromeCollapsed));
  }, [chromeCollapsed]);

  useEffect(() => {
    if (forceMode && mode !== forceMode) setMode(forceMode);
    else if (!forceMode && mobileCore && mode !== "list") setMode("list");
  }, [forceMode, mobileCore, mode]);

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
  const parentPool = hierarchyTasks?.length ? hierarchyTasks : tasks;
  const findPoolItem = (id: string) => {
    const key = normalizeItemId(id);
    return parentPool.find((candidate) => normalizeItemId(candidate?.id) === key) || null;
  };
  const parentOptions = useMemo(() => {
    return allowedParentItems(
      { id: "__new__", workItemType: newType, projectId: newProjectId || baseProjectId },
      parentPool,
    );
  }, [baseProjectId, newProjectId, newType, parentPool]);

  useEffect(() => {
    if (newParentId && !parentOptions.some((item) => item.id === newParentId)) {
      setNewParentId("");
    }
  }, [newParentId, parentOptions]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = hierarchyTasks?.length ? hierarchyTasks : tasks;
    return sortItems(tasks.filter((item) => {
      const matchesProject = projectFilter === "all" ||
        (projectFilter === "no_project" ? !item.projectId : item.projectId === projectFilter);
      const matchesStatus = matchesStatusFilter(item, statusFilter);
      const matchesPriority = priorityFilter === "all" || priorityValue(effectivePriority(item, pool)) === priorityFilter;
      const itemKind = workItemKind(item);
      const matchesType = typeFilter === "all" || itemKind === typeFilter;
      const matchesOwner = ownerFilter === "all" || String(effectiveInheritedField(item, pool, "owner") || item.owner || item.assignee || "") === ownerFilter;
      const matchesDate = dateFilter === "all" || dueBucket(item.dueDate || item.targetDate) === dateFilter;
      const matchesItemTag = matchesTag(item, tagFilter);
      const matchesWorkCategory = workCategoryFilter === "all" || String(effectiveInheritedField(item, pool, "workCategory") || itemWorkCategory(item, projects)) === workCategoryFilter;
      const matchesProductPhase = productPhaseFilter === "all" || String(effectiveInheritedField(item, pool, "productPhase") || itemProductPhase(item, projects)) === productPhaseFilter;
      const matchesSprint = itemMatchesSprint(item, sprintFilter);
      const searchable = `${title(item)} ${item.description || ""} ${item.key || ""} ${itemProjectTitle(item, projects)} ${deliveryEntity(item, projects)} ${clientEntity(item, projects)} ${itemWorkCategory(item, projects)} ${itemProductPhase(item, projects)} ${tagLabels(item, tags).join(" ")}`.toLowerCase();
      return matchesProject && matchesStatus && matchesPriority && matchesType && matchesOwner && matchesDate && matchesItemTag && matchesWorkCategory && matchesProductPhase && matchesSprint && (!needle || searchable.includes(needle));
    }), primarySort, secondarySort, projects, pool);
  }, [dateFilter, hierarchyTasks, ownerFilter, priorityFilter, productPhaseFilter, projectFilter, projects, query, primarySort, secondarySort, sprintFilter, statusFilter, tagFilter, tags, tasks, typeFilter, workCategoryFilter]);

  const columnCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of filtered) {
      const key = kanbanColumnForStatus(canonicalStatus(item));
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [filtered]);
  const draggingColumn = draggingId
    ? kanbanColumnForStatus(canonicalStatus(tasks.find((item) => item.id === draggingId)))
    : "";
  const viewerAliases = useMemo(() => {
    const self = workspaceMembers.find((member) => member.userId === viewerId || member.id === viewerId);
    return [self ? memberName(self) : "", user?.displayName, user?.email]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }, [user?.displayName, user?.email, viewerId, workspaceMembers]);
  const mentionAlertItem = useMemo(
    () => filtered.find((item) => itemMentionsViewer(item, viewerAliases)) || null,
    [filtered, viewerAliases],
  );

  useEffect(() => {
    if (!openAttr && !createAttr) return undefined;
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".do-item-attr")) return;
      setOpenAttr(null);
      setCreateAttr(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenAttr(null);
        setCreateAttr(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openAttr, createAttr]);

  const bounceCard = (id: string) => {
    setBouncingId(id);
    if (bounceTimer.current) window.clearTimeout(bounceTimer.current);
    bounceTimer.current = window.setTimeout(() => setBouncingId(null), 480);
  };

  const rejectWipMove = (item: any, destColumn: string) => {
    const sourceColumn = kanbanColumnForStatus(canonicalStatus(item));
    if (canAcceptWipDrop(sourceColumn, destColumn, columnCounts[destColumn] || 0, kanbanWipLimits[destColumn])) {
      return false;
    }
    bounceCard(item.id);
    const deliveryColumn = KANBAN_COLUMNS.find((column) => column.key === destColumn);
    setKanbanError(`${kanbanColumnLabels[destColumn] || deliveryColumn?.label || destColumn} is at its WIP limit (${kanbanWipLimits[destColumn]}).`);
    return true;
  };

  useEffect(() => {
    if (!workspaceId || !viewerId) return;
    const self = workspaceMembers.find((member) => member.userId === viewerId || member.id === viewerId);
    const displayName = self ? memberName(self) : "You";
    const beat = () => {
      heartbeatKanbanPresence({ workspaceId, userId: viewerId, surface, displayName }).catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, 20_000);
    const stop = listenKanbanPresence(workspaceId, surface, setBoardViewers);
    return () => {
      window.clearInterval(timer);
      stop();
    };
  }, [surface, viewerId, workspaceId, workspaceMembers]);

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

  useEffect(() => {
    if (!selectedItemId) return undefined;
    const onKey = (event: { key: string }) => {
      if (event.key === "Escape") onSelectItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelectItem, selectedItemId]);

  const createItem = async () => {
    const projectId = newProjectId || baseProjectId;
    if (!newTitle.trim()) return;
    const project = projects.find((candidate) => candidate.id === projectId);
    const inheritedDeliveryEntity = String(
      newDeliveryEntity || project?.deliveryEntity || project?.bpo || "",
    );
    const inheritedClientEntity = String(
      project?.clientEntity || project?.client || "",
    );
    const parent = findPoolItem(newParentId);
    const links = parentLinkPatch(parent);
    const assigneeMember = workspaceMembers.find((member) => member.id === newAssigneeId || member.userId === newAssigneeId);
    const assigneeName = assigneeMember ? memberName(assigneeMember) : "";
    await onAddTask(projectId, newTitle.trim(), "backlog", {
      workItemType: newType,
      itemType: newType,
      taskType: newType,
      ...links,
      deliveryEntity: inheritedDeliveryEntity,
      bpo: inheritedDeliveryEntity,
      clientEntity: inheritedClientEntity,
      client: inheritedClientEntity,
      workCategory: project ? workCategory(project) : "Personal / Errand",
      productPhase: project ? productPhase(project) : "Explore",
      priority: newPriority === "N/A" ? null : newPriority,
      dueDate: newDueDate || null,
      ...(assigneeMember ? {
        assigneeIds: [assigneeMember.id],
        assignees: [assigneeName],
        owner: assigneeName,
        assignee: assigneeName,
      } : {}),
      order: tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId).length,
      rank: tasks.filter((item) => projectId ? item.projectId === projectId : !item.projectId).length,
    });
    setNewTitle("");
    setNewParentId("");
    setNewDueDate("");
    setNewAssigneeId("");
    setNewPriority("N/A");
    setNewDeliveryEntity("");
  };

  const createInlineChild = async (parent: any) => {
    const childKinds = allowedChildKinds(workItemKind(parent));
    if (!childKinds.length) return;
    const text = String(inlineAddDrafts[parent.id] || "").trim();
    if (!text) return;
    const kind = childKinds[0];
    const projectId = parent.projectId || newProjectId || baseProjectId || "";
    const links = parentLinkPatch(parent);
    const project = projects.find((candidate) => candidate.id === projectId);
    const inheritedDeliveryEntity = String(project?.deliveryEntity || project?.bpo || "");
    const inheritedClientEntity = String(project?.clientEntity || project?.client || "");
    await onAddTask(projectId, text, "backlog", {
      workItemType: kind,
      itemType: kind,
      taskType: kind,
      ...links,
      deliveryEntity: inheritedDeliveryEntity,
      bpo: inheritedDeliveryEntity,
      clientEntity: inheritedClientEntity,
      client: inheritedClientEntity,
      workCategory: project ? workCategory(project) : "Personal / Errand",
      productPhase: project ? productPhase(project) : "Explore",
      priority: null,
      order: tasks.filter((item) => (projectId ? item.projectId === projectId : !item.projectId)).length,
      rank: tasks.filter((item) => (projectId ? item.projectId === projectId : !item.projectId)).length,
    });
    setInlineAddDrafts((current) => ({ ...current, [parent.id]: "" }));
    window.setTimeout(() => inlineAddRefs.current[parent.id]?.focus(), 0);
  };

  const changeItemType = (item: any, kind: WorkItemKind) => {
    const allowed = allowedParentKinds(kind);
    const currentParent = findPoolItem(parentId(item));
    const parentOk = Boolean(currentParent && allowed.includes(workItemKind(currentParent)));
    onUpdateTask(item.id, {
      workItemType: kind,
      itemType: kind,
      taskType: kind,
      ...parentLinkPatch(parentOk ? currentParent : null),
    });
  };

  const createKanbanItem = async (columnKey: string) => {
    const projectId = newProjectId || baseProjectId;
    const text = kanbanDraftTitle.trim();
    if (!text) {
      setKanbanDraftColumn(null);
      return;
    }
    const project = projects.find((candidate) => candidate.id === projectId);
    const inheritedDeliveryEntity = String(project?.deliveryEntity || project?.bpo || "");
    const inheritedClientEntity = String(project?.clientEntity || project?.client || "");
    await onAddTask(projectId, text, laneForKanbanColumn(columnKey), {
      workItemType: newType,
      itemType: newType,
      taskType: newType,
      parentId: null,
      deliveryEntity: inheritedDeliveryEntity,
      bpo: inheritedDeliveryEntity,
      clientEntity: inheritedClientEntity,
      client: inheritedClientEntity,
      workCategory: project ? workCategory(project) : "Personal / Errand",
      productPhase: project ? productPhase(project) : "Explore",
      priority: null,
      order: tasks.filter((item) => (projectId ? item.projectId === projectId : !item.projectId)).length,
      rank: tasks.filter((item) => (projectId ? item.projectId === projectId : !item.projectId)).length,
    });
    setKanbanDraftTitle("");
    setKanbanDraftColumn(null);
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
    const ordered = sortItems(peers, "rank", "priority", projects, parentPool);
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
    const previous = {
      status: item.status,
      order: item.order,
      rank: item.rank,
      dueDate: item.dueDate || null,
      assignee: item.assignee || "",
      owner: item.owner || "",
      assignees: item.assignees || [],
      priority: item.priority ?? null,
      projectId: item.projectId || null,
      completedAt: item.completedAt || null,
      statusHistory: item.statusHistory || [],
    };
    const parsed = parseKanbanDroppable(result.destination.droppableId);
    const deliveryColumn = KANBAN_COLUMNS.find((column) => column.key === parsed.columnKey);
    if (deliveryColumn && rejectWipMove(item, parsed.columnKey)) return;
    const patch: Record<string, unknown> = {
      order: result.destination.index,
      rank: result.destination.index,
    };
    if (parsed.columnKey === "calendar") {
      patch.dueDate = parsed.swimlaneKey === "unscheduled" ? null : parsed.swimlaneKey;
    } else {
      if (deliveryColumn) {
        const nextStatus = statusForKanbanColumn(parsed.columnKey, item.status);
        patch.status = nextStatus;
        patch.statusHistory = appendStatusHistory(item, nextStatus, parsed.columnKey);
        if (nextStatus === "done" || nextStatus === "cancelled") {
          patch.completedAt = item.completedAt || new Date().toISOString();
        } else if (canonicalStatus(item) === "done") {
          patch.completedAt = null;
        }
        Object.assign(patch, applyKanbanAutomations(item, parsed.columnKey, kanbanAutomations));
      }
      Object.assign(patch, swimlaneMovePatch(kanbanSwimlane, parsed.swimlaneKey, projects));
    }
    try {
      await onUpdateTask(item.id, patch);
      setKanbanError("");
    } catch (reason) {
      await onUpdateTask(item.id, previous);
      setKanbanError(reason instanceof Error ? reason.message : "The card could not be moved.");
    }
  };

  const toggleBulk = (id: string) => {
    setSelectedBulkIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const visibleBulkIds = filtered.map((item) => item.id);
  const allVisibleSelected = visibleBulkIds.length > 0 && visibleBulkIds.every((id) => selectedBulkIds.includes(id));
  const someVisibleSelected = visibleBulkIds.some((id) => selectedBulkIds.includes(id));
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedBulkIds((current) => current.filter((id) => !visibleBulkIds.includes(id)));
      return;
    }
    setSelectedBulkIds((current) => [...new Set([...current, ...visibleBulkIds])]);
  };

  const renderBulkSelect = (item: any) => (
    <button
      aria-label={`Select ${title(item)} for bulk editing`}
      className={`do-items-select ${selectedBulkIds.includes(item.id) ? "is-selected" : ""}`}
      data-testid="item-bulk-select"
      onClick={() => toggleBulk(item.id)}
      title="Select for bulk editing"
      type="button"
    >
      {selectedBulkIds.includes(item.id) ? <Check size={11} /> : <Square size={11} />}
    </button>
  );

  const selectAllClass = `do-items-select do-items-select-all ${allVisibleSelected ? "is-selected" : ""} ${someVisibleSelected && !allVisibleSelected ? "is-partial" : ""}`;
  const selectAllIcon = allVisibleSelected ? <Check size={11} /> : someVisibleSelected ? <Minus size={11} /> : <Square size={11} />;
  const renderSelectAll = (testId = "items-select-all") => (
    <button
      aria-checked={allVisibleSelected}
      aria-label={allVisibleSelected ? "Deselect all visible items" : "Select all visible items"}
      className={selectAllClass}
      data-testid={testId}
      disabled={visibleBulkIds.length === 0}
      onClick={toggleSelectAllVisible}
      role="checkbox"
      title={allVisibleSelected ? "Deselect all" : "Select all visible items"}
      type="button"
    >
      {selectAllIcon}
    </button>
  );

  const toggleDone = async (item: any) => {
    const isDone = canonicalStatus(item) === "done";
    const nextStatus = isDone ? "backlog" : "done";
    await onUpdateTask(item.id, {
      status: nextStatus,
      completedAt: isDone ? null : new Date().toISOString(),
      statusHistory: appendStatusHistory(item, nextStatus, isDone ? "backlog" : "done"),
    });
    if (isDone) return;
    const recurrenceType = (item.recurrenceType || item.recurrence || "none") as RecurrenceType;
    if (!recurrenceType || recurrenceType === "none") return;
    const due = dateInputValue(item.dueDate || item.targetDate) || new Date().toISOString().slice(0, 10);
    const nextDue = getNextOccurrence(
      item.recurrenceAnchorDate || due,
      item.occurrenceDate || due,
      new Date(),
      {
        type: recurrenceType,
        interval: item.recurrenceInterval || 1,
        unit: item.recurrenceUnit || "days",
      },
    );
    if (!nextDue) return;
    await onAddTask(item.projectId || "", title(item), "backlog", {
      workItemType: workItemKind(item),
      itemType: item.itemType,
      parentId: item.parentId || null,
      recurrenceType,
      recurrenceInterval: item.recurrenceInterval || 1,
      recurrenceUnit: item.recurrenceUnit || "days",
      recurrenceAnchorDate: item.recurrenceAnchorDate || due,
      recurrenceStatus: "active",
      isRoutineTask: true,
      recurringSeriesId: item.recurringSeriesId || item.id,
      dueDate: nextDue,
      occurrenceDate: nextDue,
      priority: item.priority ?? null,
      assigneeIds: item.assigneeIds || [],
      assignees: item.assignees || [],
      owner: item.owner || item.assignee || "",
    });
  };

  const archiveItem = (item: any) => {
    // Product delete archives the record. Do not hard-delete task documents.
    if (selectedItemId === item.id) onSelectItem(null);
    setSelectedBulkIds((current) => current.filter((id) => id !== item.id));
    return onUpdateTask(item.id, {
      status: "archived",
      archivedAt: new Date().toISOString(),
    });
  };

  const renderDeleteButton = (item: any) => (
    <button
      aria-label={`Delete ${title(item)}`}
      className="do-items-delete"
      data-testid="item-delete"
      onClick={(event) => {
        event.stopPropagation();
        void archiveItem(item);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      title={`Delete ${title(item)}`}
      type="button"
    >
      <Trash size={14} />
    </button>
  );

  const renderTitleCell = (
    item: any,
    kind: WorkItemKind,
    childCount: number,
    tree?: { depth: number; childCount: number; collapsed: boolean; onToggle: () => void; showToggle?: boolean; onEnterAddChild?: () => void },
  ) => (
    itemColumnSet.has("title") ? (
      <div className="do-items-title" style={tree?.depth ? { paddingLeft: tree.depth * 16 } : undefined}>
        {tree?.showToggle !== false && tree && (tree.childCount > 0 || Boolean(tree.onEnterAddChild)) ? (
          <button
            aria-expanded={!tree.collapsed}
            aria-label={`${tree.collapsed ? "Expand" : "Collapse"} ${title(item)}`}
            className={`do-items-section-toggle${tree.collapsed ? " is-collapsed" : ""}`}
            data-testid="item-tree-toggle"
            onClick={(event) => {
              event.stopPropagation();
              tree.onToggle();
            }}
            type="button"
          >
            <ChevronDown size={14} />
          </button>
        ) : tree ? <span className="do-items-tree-spacer" /> : null}
        <button
          aria-label={`${workItemLabel(kind)} ${title(item)}`}
          className={`do-items-type-flag is-icon is-${kind}`}
          data-testid="item-type-flag"
          data-tip={workItemLabel(kind)}
          onClick={() => onSelectItem(item.id)}
          type="button"
        >
          {(() => {
            const TypeIcon = WORK_ITEM_TYPE_ICONS[kind] || Target;
            return <TypeIcon aria-hidden="true" size={13} />;
          })()}
        </button>
        <InlineText
          ariaLabel={`Title for ${title(item)}`}
          onCommit={(next) => next && onUpdateTask(item.id, { title: next })}
          onEnter={tree?.onEnterAddChild}
          value={title(item)}
        />
        {childCount ? <small>{childCount}</small> : null}
      </div>
    ) : null
  );

  const renderFieldEditor = (item: any, column: Exclude<ItemColumnKey, "title">) => {
    if (column === "project") {
      return (
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
      );
    }
    if (column === "delivery_entity") {
      return <ControlledSelect ariaLabel={`Delivery Entity for ${title(item)}`} onAddOption={(name) => onCreateControlledOption?.("delivery_entity", name)} onChange={(next) => onUpdateTask(item.id, { deliveryEntity: next || "Internal", bpo: next || "Internal" })} options={deliveryEntityOptions} value={deliveryEntity(item, projects)} />;
    }
    if (column === "client_entity") {
      return <ControlledSelect ariaLabel={`Client Entity for ${title(item)}`} onAddOption={(name) => onCreateControlledOption?.("client_entity", name)} onChange={(next) => onUpdateTask(item.id, { clientEntity: next || "Internal", client: next || "Internal" })} options={clientEntityOptions} value={clientEntity(item, projects)} />;
    }
    if (column === "tags") {
      return <CompactTagPicker label={`Tags for ${title(item)}`} onCreateTag={(name) => onCreateControlledOption?.("tag", name)} onChange={(patch) => onUpdateTask(item.id, patch)} record={item} tags={tags} />;
    }
    if (column === "work_category") {
      return (
        <select aria-label={`Work Category for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { workCategory: event.target.value })} value={itemWorkCategory(item, projects)}>
          {WORK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      );
    }
    if (column === "product_phase") {
      return (
        <select aria-label={`Product Phase for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { productPhase: event.target.value })} value={itemProductPhase(item, projects)}>
          {PRODUCT_PHASES.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
        </select>
      );
    }
    if (column === "status") {
      return (
        <select aria-label={`Status for ${title(item)}`} className={`do-items-status-pill is-${canonicalStatus(item)}`} onChange={(event) => onUpdateTask(item.id, { status: event.target.value })} value={canonicalStatus(item)}>
          {workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}
        </select>
      );
    }
    if (column === "priority") {
      return (
        <select aria-label={`Priority for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, { priority: event.target.value === "N/A" ? null : event.target.value })} value={priorityValue(item.priority)}>
          {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
      );
    }
    if (column === "gtd") {
      return (
        <select aria-label={`GTD action type for ${title(item)}`} onChange={(event) => onUpdateTask(item.id, gtdActionPatch(event.target.value))} value={gtdActionValue(item)}>
          {gtdActionTypes.map((type) => <option key={type.value || "none"} value={type.value}>{type.label}</option>)}
        </select>
      );
    }
    if (column === "bucket") {
      return <span className="do-items-when" aria-label={`Action Board bucket for ${title(item)}`}>{displayDueBucket(item)}</span>;
    }
    if (column === "assignees") {
      return <MultiAssigneePicker members={workspaceMembers} onChange={(assigneeIds, assignees) => onUpdateTask(item.id, { assigneeIds, assignees, owner: assignees[0] || "", assignee: assignees[0] || "" })} selectedIds={Array.isArray(item.assigneeIds) ? item.assigneeIds : []} selectedNames={Array.isArray(item.assignees) ? item.assignees : [item.owner || item.assignee].filter(Boolean)} />;
    }
    if (column === "due") {
      return <input aria-label={`Due date for ${title(item)}`} defaultValue={dateInputValue(item.dueDate || item.targetDate)} onBlur={(event) => onUpdateTask(item.id, { dueDate: event.target.value || null })} type="date" />;
    }
    return (
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
    );
  };

  const assignParent = (item: any, nextId: string) => {
    const parent = nextId ? findPoolItem(nextId) : null;
    const allowed = allowedParentKinds(workItemKind(item));
    if (nextId && parent && !allowed.includes(workItemKind(parent))) return;
    if (nextId && !parent) return;
    onUpdateTask(item.id, parentLinkPatch(parent));
    setOpenAttr(null);
    setParentSearch("");
  };

  const renderParentEditor = (item: any) => {
    const kind = workItemKind(item);
    const allowed = allowedParentKinds(kind);
    if (allowed.length === 0) {
      return <span className="do-parent-hint">Epics sit at the top of the tree.</span>;
    }
    const candidates = allowedParentItems(item, parentPool);
    const current = parentId(item);
    const currentItem = current ? findPoolItem(current) : null;
    const options = currentItem && !candidates.some((candidate) => candidate.id === currentItem.id)
      ? [currentItem, ...candidates]
      : candidates;
    const needle = parentSearch.trim().toLowerCase();
    const visible = (needle
      ? options.filter((candidate) => `${workItemLabel(workItemKind(candidate))} ${title(candidate)}`.toLowerCase().includes(needle))
      : options
    ).slice(0, 40);
    const labels = allowed.map((value) => workItemLabel(value)).join(" or ");
    return (
      <div className="do-parent-picker" data-testid="item-parent-field">
        <input
          aria-label={`Search ${labels} parent`}
          onChange={(event) => setParentSearch(event.target.value)}
          placeholder={`Search ${labels}…`}
          value={parentSearch}
        />
        <div className="do-parent-options" role="listbox" aria-label={`${labels} parents`}>
          <button
            className={!current ? "is-active" : ""}
            onClick={() => assignParent(item, "")}
            type="button"
          >
            No parent
          </button>
          {visible.map((candidate) => (
            <button
              aria-selected={candidate.id === current}
              className={candidate.id === current ? "is-active" : ""}
              key={candidate.id}
              onClick={() => assignParent(item, candidate.id)}
              role="option"
              type="button"
            >
              <span className="do-parent-kind">{workItemLabel(workItemKind(candidate))}</span>
              <span>{title(candidate)}</span>
            </button>
          ))}
        </div>
        {options.length === 0 && (
          <small>No {labels} yet. Create one, then assign it here.</small>
        )}
        {options.length > 0 && visible.length === 0 && (
          <small>No matching {labels}. Try another name.</small>
        )}
        {options.length > visible.length && needle === "" && (
          <small>Showing {visible.length} of {options.length}. Type to find the rest.</small>
        )}
      </div>
    );
  };

  const renderAttributeIcons = (item: any) => (
    <div className="do-item-attrs" data-testid="item-attr-icons">
      {(() => {
        const filled = Boolean(parentId(item));
        const parentItem = parentId(item) ? findPoolItem(parentId(item)) : null;
        const caption = parentItem ? title(parentItem) : "No parent";
        const key = `${item.id}:parent`;
        const open = openAttr === key;
        const allowed = allowedParentKinds(workItemKind(item));
        if (allowed.length === 0) return null;
        return (
          <div className={`do-item-attr is-parent ${filled ? "is-on" : "is-off"} ${open ? "is-open" : ""}`} key="parent">
            <button
              aria-expanded={open}
              aria-label={`Parent for ${title(item)}${filled ? `: ${caption}` : " (not set)"}`}
              className="do-item-attr-btn"
              data-testid="item-attr-parent"
              onClick={(event) => {
                event.stopPropagation();
                setParentSearch("");
                setOpenAttr(open ? null : key);
              }}
              title={allowed.length === 0 ? "Epics have no parent" : `Parent: ${caption}`}
              type="button"
            >
              <GitBranch size={13} />
            </button>
            {open && (
              <div
                className="do-item-attr-pop"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <strong>Parent</strong>
                {renderParentEditor(item)}
              </div>
            )}
          </div>
        );
      })()}
      {attributeColumns.map((column) => {
        const filled = itemAttributePresent(item, column, projects, tags, parentPool);
        const caption = itemAttributeCaption(item, column, projects, tags, sprints, parentPool);
        const Icon = ATTR_ICONS[column];
        const key = `${item.id}:${column}`;
        const open = openAttr === key;
        return (
          <div className={`do-item-attr ${filled ? "is-on" : "is-off"} ${open ? "is-open" : ""}`} key={column}>
            <button
              aria-expanded={open}
              aria-label={`${itemColumnLabels[column]} for ${title(item)}${filled ? `: ${caption}` : " (not set)"}`}
              className="do-item-attr-btn"
              data-testid={`item-attr-${column}`}
              onClick={(event) => {
                event.stopPropagation();
                setOpenAttr(open ? null : key);
              }}
              title={`${itemColumnLabels[column]}: ${caption}`}
              type="button"
            >
              <Icon size={13} />
            </button>
            {open && (
              <div
                className="do-item-attr-pop"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <strong>{itemColumnLabels[column]}</strong>
                {renderFieldEditor(item, column)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderRow = (
    item: any,
    peers: any[],
    tree?: { depth: number; childCount: number; collapsed: boolean; onToggle: () => void; onEnterAddChild?: () => void },
  ) => {
    const kind = workItemKind(item);
    const childCount = tree?.childCount ?? tasks.filter((candidate) => parentId(candidate) === item.id).length;
    const isDone = canonicalStatus(item) === "done";
    return (
      <article
        className={`do-items-row is-icon-list is-${kind} ${isDone ? "is-done" : ""} ${selectedItemId === item.id ? "is-selected" : ""} ${draggedItemId === item.id ? "is-dragging" : ""} ${dragOverItemId === item.id ? "is-drag-over" : ""}`}
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
        {renderBulkSelect(item)}
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
        {renderTitleCell(item, kind, childCount, tree)}
        {renderAttributeIcons(item)}
        {renderDeleteButton(item)}
      </article>
    );
  };

  const startKanbanColumnResize = (columnKey: string, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = kanbanColumnPixels[columnKey] || DEFAULT_KANBAN_COLUMN_WIDTH;
    handle.setPointerCapture(event.pointerId);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (move: PointerEvent) => {
      move.preventDefault();
      updateKanbanColumnWidth(columnKey, startWidth + (move.clientX - startX));
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
    <div className="do-items-column-head is-icon-list" style={itemGridStyle}>
      <span />
      {renderSelectAll()}
      <span />
      <strong>Item</strong>
      <span className="do-items-attr-head">Fields</span>
      <span />
    </div>
  );

  const toggleGroup = (group: string) => {
    setCollapsedGroups((current) => current.includes(group)
      ? current.filter((item) => item !== group)
      : [...current, group]);
  };

  const isTreeNodeCollapsed = (groupKey: string, kind: WorkItemKind, depth: number) =>
    isTreeNodeCollapsedState({
      kind,
      depth,
      groupKey,
      expandedKeys: expandedTreeNodes,
    });

  const clearInlineAddForNode = (groupKey: string) => {
    if (!groupKey.startsWith("node:")) return;
    const parentIdValue = groupKey.slice(5);
    setInlineAddOpen((current) => {
      if (!current[parentIdValue]) return current;
      const next = { ...current };
      delete next[parentIdValue];
      return next;
    });
  };

  const toggleTreeNode = (groupKey: string, _kind: WorkItemKind, _depth: number) => {
    const collapsing = !isTreeNodeCollapsed(groupKey, _kind, _depth);
    setExpandedTreeNodes((current) => collapsing
      ? current.filter((key) => key !== groupKey)
      : current.includes(groupKey) ? current : [...current, groupKey]);
    if (collapsing) clearInlineAddForNode(groupKey);
  };

  const focusInlineAdd = (parentIdValue: string, groupKey: string, kind: WorkItemKind, depth: number) => {
    if (isTreeNodeCollapsed(groupKey, kind, depth)) {
      setExpandedTreeNodes((current) => current.includes(groupKey) ? current : [...current, groupKey]);
    }
    setInlineAddOpen((current) => ({ ...current, [parentIdValue]: true }));
    window.setTimeout(() => {
      inlineAddRefs.current[parentIdValue]?.focus();
    }, 0);
  };

  const renderSectionHead = (item: any, groupKey: string, childCount: number) => {
    const kind = workItemKind(item);
    const depth = 0;
    const collapsed = isTreeNodeCollapsed(groupKey, kind, depth);
    const isDone = canonicalStatus(item) === "done";
    const canAddChild = allowedChildKinds(kind).length > 0;
    return (
      <header
        className={`do-items-row do-items-section-head is-icon-list is-${kind} ${isDone ? "is-done" : ""} ${selectedItemId === item.id ? "is-selected" : ""}`}
        data-testid="item-section-head"
        style={itemGridStyle}
      >
        <button
          aria-label={`${isDone ? "Reopen" : "Mark done"} ${title(item)}`}
          className={`do-items-check ${isDone ? "is-done" : ""}`}
          data-testid="item-epic-complete"
          onClick={() => toggleDone(item)}
          title={isDone ? "Reopen epic" : "Mark epic done"}
          type="button"
        >
          {isDone ? <Check size={12} /> : <Circle size={12} />}
        </button>
        {renderBulkSelect(item)}
        <button
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${title(item)}`}
          className={`do-items-section-toggle${collapsed ? " is-collapsed" : ""}`}
          data-testid="item-tree-toggle"
          onClick={() => toggleTreeNode(groupKey, kind, depth)}
          type="button"
        >
          <ChevronDown size={14} />
        </button>
        {renderTitleCell(item, kind, childCount, {
          depth: 0,
          childCount,
          collapsed,
          onToggle: () => toggleTreeNode(groupKey, kind, depth),
          showToggle: false,
          onEnterAddChild: canAddChild ? () => focusInlineAdd(item.id, groupKey, kind, depth) : undefined,
        })}
        {renderAttributeIcons(item)}
        {renderDeleteButton(item)}
      </header>
    );
  };

  const compareVisibleSiblings = (left: any, right: any) =>
    compareItems(left, right, primarySort, secondarySort, projects, parentPool);

  const renderInlineAddChild = (parent: any, depth: number, groupKey: string) => {
    const childKinds = allowedChildKinds(workItemKind(parent));
    if (!childKinds.length) return null;
    const childKind = childKinds[0];
    const childLabel = workItemLabel(childKind);
    const addLabel = `Add ${childLabel}`;
    const draft = inlineAddDrafts[parent.id] || "";
    const open = Boolean(inlineAddOpen[parent.id]);
    const indent = Math.max(depth + 1, 1) * 16;
    if (!open) {
      return (
        <button
          aria-label={`${addLabel} under ${title(parent)}`}
          className="do-items-inline-add-btn"
          data-testid="item-inline-add-child"
          onClick={() => focusInlineAdd(parent.id, groupKey, workItemKind(parent), depth)}
          style={{ paddingLeft: indent }}
          type="button"
        >
          <Plus size={12} aria-hidden="true" />
          <span>{addLabel}</span>
        </button>
      );
    }
    return (
      <div
        className="do-items-inline-add is-open"
        data-testid="item-inline-add-child"
        style={{ paddingLeft: indent }}
      >
        <Plus size={12} aria-hidden="true" />
        <input
          aria-label={`${addLabel} under ${title(parent)}`}
          onBlur={(event) => {
            if (!event.currentTarget.value.trim()) {
              setInlineAddOpen((current) => {
                if (!current[parent.id]) return current;
                const next = { ...current };
                delete next[parent.id];
                return next;
              });
            }
          }}
          onChange={(event) => setInlineAddDrafts((current) => ({ ...current, [parent.id]: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void createInlineChild(parent);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setInlineAddDrafts((current) => ({ ...current, [parent.id]: "" }));
              setInlineAddOpen((current) => {
                const next = { ...current };
                delete next[parent.id];
                return next;
              });
            }
          }}
          placeholder={`${addLabel}…`}
          ref={(node) => {
            inlineAddRefs.current[parent.id] = node;
          }}
          value={draft}
        />
      </div>
    );
  };

  const renderForest = (items: any[]) => {
    // Roots stay scoped to the visible list (My Work / filters). Children resolve
    // from the full hierarchy pool so expand twisties work like Asana project
    // lists — and like the My Tasks request — even when subtasks are not
    // themselves in the filtered view. Status filter still applies to nested
    // children so completed work stays hidden unless the filter asks for it.
    const childPool = parentPool;
    const visibleChildrenOf = (parentIdValue: string) =>
      sortHierarchySiblings(
        hierarchyChildren(childPool, parentIdValue).filter((child) => matchesStatusFilter(child, statusFilter)),
        compareVisibleSiblings,
      );
    const walk = (item: any, depth: number, ancestors: Set<string>) => {
      if (ancestors.has(item.id)) return null;
      const children = visibleChildrenOf(item.id);
      const groupKey = `node:${item.id}`;
      const kind = workItemKind(item);
      const collapsed = isTreeNodeCollapsed(groupKey, kind, depth);
      const canAddChild = allowedChildKinds(kind).length > 0;
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(item.id);
      const tree = {
        depth,
        childCount: children.length,
        collapsed,
        onToggle: () => toggleTreeNode(groupKey, kind, depth),
        onEnterAddChild: canAddChild
          ? () => focusInlineAdd(item.id, groupKey, kind, depth)
          : undefined,
      };
      return (
        <div
          className={`do-items-tree-node do-items-parent is-${kind}${kind === "epic" && depth === 0 ? " is-epic-section" : ""}`}
          data-collapsed={collapsed ? "true" : "false"}
          data-depth={depth}
          data-testid="item-tree-node"
          key={item.id}
        >
          {kind === "epic" && depth === 0
            ? renderSectionHead(item, groupKey, children.length)
            : renderRow(item, children, tree)}
          {!collapsed ? (
            <div className="do-items-children" data-testid="item-tree-children">
              {children.map((child) => walk(child, depth + 1, nextAncestors))}
              {canAddChild ? renderInlineAddChild(item, depth, groupKey) : null}
            </div>
          ) : null}
        </div>
      );
    };
    const roots = sortHierarchySiblings(hierarchyRoots(items), compareVisibleSiblings);
    return (
      <div className="do-items-tree" data-testid="item-hierarchy-forest">
        {roots.map((item) => walk(item, 0, new Set()))}
        {items.length === 0 && <div className="do-items-empty"><ListChecks size={21} /><strong>No items here yet.</strong><span>Create the first Epic, Feature, PBI, task or bug for this context.</span></div>}
      </div>
    );
  };

  const renderHierarchy = () => renderForest(filtered);

  const grouped = useMemo(() => {
    const keyFor = (item: any) => {
      const target = FAMILY_GROUP_BY.has(groupBy) ? hierarchyRoot(item, tasks) : item;
      if (groupBy === "actionBoard") return actionBoardBucket(target);
      if (groupBy === "status") return canonicalStatus(target);
      if (groupBy === "priority") return priorityValue(effectivePriority(target, tasks));
      if (groupBy === "project") return itemProjectTitle(target, projects);
      if (groupBy === "owner") return String(effectiveInheritedField(target, tasks, "owner") || target.owner || target.assignee || "Unassigned");
      if (groupBy === "type") return workItemLabel(workItemKind(target));
      if (groupBy === "work_category") return String(effectiveInheritedField(target, tasks, "workCategory") || itemWorkCategory(target, projects));
      if (groupBy === "product_phase") return String(effectiveInheritedField(target, tasks, "productPhase") || itemProductPhase(target, projects));
      if (groupBy === "due") return dueBucketLabels[dueBucket(target.dueDate || target.targetDate)] || "No sector";
      if (groupBy === "tag") return tagLabels(target, tags)[0] || "No tag";
      return "Items";
    };
    return filtered.reduce<Record<string, any[]>>((acc, item) => {
      const key = keyFor(item);
      acc[key] = [...(acc[key] || []), item];
      return acc;
    }, {});
  }, [filtered, groupBy, projects, tags, tasks]);

  const renderBoardCard = (item: any) => {
    const kind = workItemKind(item);
    const due = dateInputValue(item.dueDate || item.targetDate);
    const isDone = canonicalStatus(item) === "done";
    const priority = priorityValue(effectivePriority(item, parentPool));
    const dueText = due ? dateLabel(new Date(`${due}T00:00:00`)) : "";
    const stopCardDrag = (event: { stopPropagation: () => void }) => event.stopPropagation();
    const checks = checklistProgress(checklistItems(item));
    const live = boardViewers.some((viewer) => {
      const names = Array.isArray(item.assignees) ? item.assignees : [item.owner || item.assignee];
      return names.some((name: string) => String(name || "").toLowerCase() === viewer.displayName.toLowerCase());
    });
    return (
      <article className={`do-kanban-card is-compact is-${kind} is-p${priority === "N/A" ? "none" : priority} ${isDone ? "is-done" : ""} ${selectedItemId === item.id ? "is-selected" : ""} ${bouncingId === item.id ? "is-wip-bounce" : ""}`} data-testid="kanban-card" key={item.id}>
        <span className={`do-kanban-priority-stripe is-${priority === "N/A" ? "none" : priority}`} />
        <div className="do-kanban-card-head">
          <span onPointerDown={stopCardDrag}>{renderBulkSelect(item)}</span>
          <button className="do-kanban-card-title" onClick={() => onSelectItem(item.id)} type="button">
            <strong>{title(item)}</strong>
          </button>
          {renderDeleteButton(item)}
        </div>
        {checks.total > 0 && (
          <div className="do-kanban-card-meta" onPointerDown={stopCardDrag}>
            <span className="do-kanban-progress" title="Checklist">
              <i style={{ width: `${checks.percent}%` }} />
              <em>{checks.done}/{checks.total}</em>
            </span>
          </div>
        )}
        <div className="do-kanban-card-foot" onPointerDown={stopCardDrag}>
          <span className={`do-kanban-live-wrap ${live ? "is-live" : ""}`}>
            <i className="do-kanban-live-dot" data-testid="kanban-live-dot" />
            <MultiAssigneePicker
              compact
              label="Item assignees"
              members={workspaceMembers}
              onChange={(assigneeIds, assignees) => onUpdateTask(item.id, { assigneeIds, assignees, owner: assignees[0] || "", assignee: assignees[0] || "" })}
              selectedIds={Array.isArray(item.assigneeIds) ? item.assigneeIds : []}
              selectedNames={Array.isArray(item.assignees) ? item.assignees : [item.owner || item.assignee].filter(Boolean)}
            />
          </span>
          {allowedParentKinds(kind).length > 0 && (
            <button
              aria-label={`Assign parent for ${title(item)}`}
              className={`do-kanban-parent ${parentId(item) ? "is-on" : ""}`}
              data-testid="kanban-assign-parent"
              onClick={() => {
                onSelectItem(item.id);
                setParentSearch("");
                window.setTimeout(() => {
                  document.querySelector<HTMLElement>('[data-testid="item-parent-field"] input')?.focus();
                }, 0);
              }}
              title={parentId(item) ? `Parent: ${title(findPoolItem(parentId(item)) || { title: "set" })}` : "Assign parent"}
              type="button"
            >
              <GitBranch size={13} />
            </button>
          )}
          <label className={`do-kanban-card-due${due ? "" : " is-empty"}`}>
            <Calendar size={12} aria-hidden="true" />
            <time>{dueText || "Date"}</time>
            <input aria-label={`Due date for ${title(item)}`} defaultValue={due} onBlur={(event) => onUpdateTask(item.id, { dueDate: event.target.value || null })} type="date" />
          </label>
        </div>
      </article>
    );
  };

  const renderKanbanColumnBody = (columnKey: string, columnTitle: string, items: any[], droppableId: string, wipCount = items.length) => {
    const destColumn = parseKanbanDroppable(droppableId).columnKey;
    const dropBlocked = Boolean(
      draggingId && !canAcceptWipDrop(draggingColumn, destColumn, columnCounts[destColumn] || 0, kanbanWipLimits[destColumn]),
    );
    const tone = wipTone(wipCount, kanbanWipLimits[columnKey]);
    return (
    <Droppable droppableId={droppableId} key={droppableId}>
      {(provided, snapshot) => (
        <section
          className={`do-kanban-column is-wip-${tone} ${snapshot.isDraggingOver ? (dropBlocked ? "is-drop-blocked" : "is-drop-ok") : ""}`}
          data-testid="kanban-column"
          ref={provided.innerRef}
          style={{ "--kanban-col-width": `${kanbanColumnPixels[columnKey] || DEFAULT_KANBAN_COLUMN_WIDTH}px` } as CSSProperties}
          {...provided.droppableProps}
        >
          <header>
            <strong>{kanbanColumnLabels[columnKey] || columnTitle}</strong>
            <span className={tone === "ok" ? "" : `is-wip-${tone}`} title={kanbanWipLimits[columnKey] ? "Work in progress limit" : "Cards in this column"}>
              {wipCaption(wipCount, kanbanWipLimits[columnKey])}
            </span>
            <button
              aria-label={`Add item to ${columnTitle}`}
              className="do-kanban-column-add"
              onClick={() => {
                setKanbanDraftColumn(droppableId);
                setKanbanDraftTitle("");
              }}
              type="button"
            >
              <Plus size={14} />
            </button>
            <span
              aria-label={`Resize ${columnTitle} column`}
              className="do-kanban-col-resizer"
              data-testid="kanban-column-resizer"
              onPointerDown={(event) => startKanbanColumnResize(columnKey, event)}
              role="separator"
            />
          </header>
          <div>
            {items.map((item, index) => (
              <Draggable draggableId={item.id} index={index} key={item.id}>
                {(drag) => (
                  <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                    {renderBoardCard(item)}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {kanbanDraftColumn === droppableId ? (
              <form
                className="do-kanban-draft"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createKanbanItem(columnKey);
                }}
              >
                <input
                  aria-label={`New item in ${columnTitle}`}
                  autoFocus
                  data-testid="kanban-draft-title"
                  onBlur={() => {
                    if (!kanbanDraftTitle.trim()) setKanbanDraftColumn(null);
                  }}
                  onChange={(event) => setKanbanDraftTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setKanbanDraftColumn(null);
                      setKanbanDraftTitle("");
                    }
                  }}
                  placeholder="Write a task name"
                  value={kanbanDraftTitle}
                />
              </form>
            ) : (
              <button
                className="do-kanban-add-task"
                onClick={() => {
                  setKanbanDraftColumn(droppableId);
                  setKanbanDraftTitle("");
                }}
                type="button"
              >
                <Plus size={14} /> Add task
              </button>
            )}
          </div>
        </section>
      )}
    </Droppable>
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
    const lanes = uniqueSwimlanes(filtered, kanbanSwimlane, projects);

    return (
      <DragDropContext
        onDragEnd={(result) => {
          setDraggingId(null);
          void persistKanbanMove(result);
        }}
        onDragStart={(start: DragStart) => setDraggingId(start.draggableId)}
      >
        {kanbanError && <p className="do-signin-error" data-testid="kanban-wip-reject" role="alert">{kanbanError}</p>}
        {mentionAlertItem && (
          <p className="do-kanban-mention-alert" data-testid="kanban-mention-alert" role="status">
            You were mentioned on {title(mentionAlertItem)}.
          </p>
        )}
        {kanbanSwimlane === "none" ? (
          <div className={`do-kanban-board ${groupBy === "actionBoard" ? "is-action-board" : "is-dynamic-board"}`} data-testid="kanban-board">
            {visibleColumns.map((column) => renderKanbanColumnBody(column.key, column.title, column.items, column.key))}
            {filtered.length === 0 && <div className="do-items-empty"><ListChecks size={21} /><strong>No items match the current filters.</strong><span>Clear a filter or create the next item.</span></div>}
          </div>
        ) : (
          <div className="do-kanban-swim-board" data-testid="kanban-board">
            {lanes.map((lane) => (
              <div className="do-kanban-swimlane" data-testid="kanban-swimlane" key={lane.key || "all"}>
                <h3>{lane.label}</h3>
                <div className="do-kanban-board">
                  {visibleColumns.map((column) => {
                    const laneItems = column.items.filter((item) => swimlaneKeyFor(item, kanbanSwimlane, projects) === lane.key);
                    return renderKanbanColumnBody(
                      column.key,
                      column.title,
                      laneItems,
                      encodeKanbanDroppable(column.key, lane.key),
                      column.items.length,
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="do-items-empty"><ListChecks size={21} /><strong>No items match the current filters.</strong><span>Clear a filter or create the next item.</span></div>}
          </div>
        )}
      </DragDropContext>
    );
  };

  const renderCalendar = () => {
    const days = calendarWeekDays(calendarAnchor);
    const datedIds = new Set(days.flatMap((day) => filtered.filter((item) => itemDueKey(item) === day.key).map((item) => item.id)));
    const unscheduled = filtered.filter((item) => !datedIds.has(item.id) && !itemDueKey(item));
    const shiftWeek = (delta: number) => {
      const next = new Date(calendarAnchor);
      next.setDate(next.getDate() + delta * 7);
      setCalendarAnchor(next);
    };
    return (
      <DragDropContext
        onDragEnd={(result) => {
          setDraggingId(null);
          void persistKanbanMove(result);
        }}
        onDragStart={(start: DragStart) => setDraggingId(start.draggableId)}
      >
        <div className="do-kanban-calendar" data-testid="kanban-calendar">
          <div className="do-kanban-calendar-nav">
            <button onClick={() => shiftWeek(-1)} type="button">Previous week</button>
            <strong>{days[0].label} – {days[6].label}</strong>
            <button onClick={() => setCalendarAnchor(new Date())} type="button">This week</button>
            <button onClick={() => shiftWeek(1)} type="button">Next week</button>
          </div>
          <div className="do-kanban-calendar-grid">
            {days.map((day) => {
              const items = filtered.filter((item) => itemDueKey(item) === day.key);
              return (
                <Droppable droppableId={encodeKanbanDroppable("calendar", day.key)} key={day.key}>
                  {(provided) => (
                    <section className="do-kanban-calendar-day" ref={provided.innerRef} {...provided.droppableProps}>
                      <header><strong>{day.label}</strong><span>{items.length}</span></header>
                      {items.map((item, index) => (
                        <Draggable draggableId={item.id} index={index} key={item.id}>
                          {(drag) => (
                            <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                              {renderBoardCard(item)}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </section>
                  )}
                </Droppable>
              );
            })}
            <Droppable droppableId={encodeKanbanDroppable("calendar", "unscheduled")}>
              {(provided) => (
                <section className="do-kanban-calendar-day is-unscheduled" ref={provided.innerRef} {...provided.droppableProps}>
                  <header><strong>Unscheduled</strong><span>{unscheduled.length}</span></header>
                  {unscheduled.map((item, index) => (
                    <Draggable draggableId={item.id} index={index} key={item.id}>
                      {(drag) => (
                        <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                          {renderBoardCard(item)}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </section>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>
    );
  };

  const renderAnalytics = () => {
    const series = cumulativeFlowSeries(filtered, 14);
    const layers = stackedAreaLayers(series);
    const cycle = averageDuration(filtered.map(cycleTimeMs));
    const lead = averageDuration(filtered.map(leadTimeMs));
    const wipNow = filtered.filter((item) => ["in_progress", "in_review"].includes(canonicalStatus(item))).length;
    return (
      <section className="do-kanban-analytics is-dashboard" data-testid="kanban-analytics">
        <div className="do-kanban-metrics">
          <article><span>Average time to done</span><strong>{formatDurationLong(cycle)}</strong></article>
          <article><span>Lead time</span><strong>{formatDurationLong(lead)}</strong></article>
          <article><span>In progress</span><strong>{wipNow}</strong></article>
        </div>
        <svg aria-label="Cumulative flow" className="do-kanban-cfd-area" viewBox={`0 0 ${layers.width} ${layers.height}`}>
          <polygon className="is-backlog" points={layers.backlog} />
          <polygon className="is-doing" points={layers.doing} />
          <polygon className="is-blocked" points={layers.blocked} />
          <polygon className="is-done" points={layers.done} />
        </svg>
        <ul className="do-kanban-cfd-legend">
          <li className="is-backlog">Backlog</li>
          <li className="is-doing">In progress</li>
          <li className="is-blocked">Blocked</li>
          <li className="is-done">Done</li>
        </ul>
        <p>Cumulative flow from daily column counts. Cycle time is the time a card spends after it starts until it is done.</p>
      </section>
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
  const priorityOneCount = filtered.filter((item) => priorityValue(effectivePriority(item, parentPool)) === "1").length;
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
          {!forceMode && <button aria-label="List view" className={mode === "list" ? "is-active" : ""} onClick={() => setMode("list")} type="button"><ListChecks size={14} /> List</button>}
          <button aria-label="Kanban view" className={`do-mobile-advanced ${mode === "kanban" ? "is-active" : ""}`} onClick={() => { setMode("kanban"); setGroupBy("hierarchy"); }} type="button"><Kanban size={14} /> Kanban</button>
          <button aria-label="Calendar view" className={`do-mobile-advanced ${mode === "calendar" ? "is-active" : ""}`} onClick={() => setMode("calendar")} type="button"><Calendar size={14} /> Calendar</button>
          <button aria-label="Flow analytics" className={`do-mobile-advanced ${mode === "flow" ? "is-active" : ""}`} onClick={() => setMode("flow")} type="button"><BarChart3 size={14} /> Flow</button>
          {!forceMode && <button aria-label="Gantt view" className={`do-mobile-advanced ${mode === "gantt" ? "is-active" : ""}`} onClick={() => setMode("gantt")} type="button"><CalendarRange size={14} /> Gantt</button>}
          {!forceMode && <button aria-label="Epics view" className={`do-mobile-advanced ${mode === "epics" ? "is-active" : ""}`} onClick={() => setMode("epics")} type="button">Epics</button>}
        </div>
        {(mode === "kanban" || mode === "calendar") && (
          <div className="do-kanban-board-tools">
            <label>
              Swimlanes
              <select
                aria-label="Kanban swimlanes"
                data-testid="kanban-swimlane"
                onChange={(event) => setKanbanSwimlane(event.target.value as KanbanSwimlaneBy)}
                value={kanbanSwimlane}
              >
                {KANBAN_SWIMLANES.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <div className="do-popover-anchor">
              <button
                aria-expanded={boardSettingsOpen}
                className={boardSettingsOpen ? "is-active" : ""}
                data-testid="kanban-board-settings"
                onClick={() => setBoardSettingsOpen((open) => !open)}
                type="button"
              >
                <SlidersHorizontal size={14} /> Board
              </button>
              {boardSettingsOpen && (
                <div className="do-popover do-kanban-settings" data-testid="kanban-settings">
                  <strong>WIP limits</strong>
                  {KANBAN_COLUMNS.map((column) => (
                    <label key={column.key}>
                      {kanbanColumnLabels[column.key] || column.label}
                      <input
                        aria-label={`WIP limit for ${column.label}`}
                        inputMode="numeric"
                        min={0}
                        onChange={(event) => setKanbanWipLimits((current) => ({ ...current, [column.key]: Number(event.target.value) || 0 }))}
                        type="number"
                        value={kanbanWipLimits[column.key] || ""}
                      />
                    </label>
                  ))}
                  <strong>Column names</strong>
                  {KANBAN_COLUMNS.map((column) => (
                    <label key={`label-${column.key}`}>
                      {column.label}
                      <input
                        aria-label={`Rename ${column.label}`}
                        onChange={(event) => setKanbanColumnLabels((current) => ({ ...current, [column.key]: event.target.value }))}
                        placeholder={column.label}
                        value={kanbanColumnLabels[column.key] || ""}
                      />
                    </label>
                  ))}
                  <strong>Rules</strong>
                  <p className="do-kanban-rule-help">If this, then that — runs when a card is dropped into a column.</p>
                  {kanbanAutomations.map((rule) => (
                    <div className="do-kanban-rule" data-testid="kanban-rule" key={rule.id}>
                      <span>IF a card moves to</span>
                      <select
                        aria-label="Rule trigger column"
                        onChange={(event) => setKanbanAutomations((current) => current.map((candidate) => candidate.id === rule.id ? { ...candidate, whenColumn: event.target.value } : candidate))}
                        value={rule.whenColumn}
                      >
                        {KANBAN_COLUMNS.map((column) => <option key={column.key} value={column.key}>{kanbanColumnLabels[column.key] || column.label}</option>)}
                      </select>
                      <span>THEN assign to</span>
                      <select
                        aria-label="Rule assignee"
                        onChange={(event) => setKanbanAutomations((current) => current.map((candidate) => candidate.id === rule.id ? { ...candidate, setAssignee: event.target.value || undefined } : candidate))}
                        value={rule.setAssignee || ""}
                      >
                        <option value="">Keep assignee</option>
                        {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                      </select>
                      <span>and set priority</span>
                      <select
                        aria-label="Rule priority"
                        onChange={(event) => setKanbanAutomations((current) => current.map((candidate) => candidate.id === rule.id ? { ...candidate, setPriority: event.target.value || undefined } : candidate))}
                        value={rule.setPriority || ""}
                      >
                        <option value="">Keep priority</option>
                        <option value="1">P1</option>
                        <option value="2">P2</option>
                        <option value="3">P3</option>
                        <option value="none">Clear</option>
                      </select>
                      <button aria-label="Remove rule" onClick={() => setKanbanAutomations((current) => current.filter((candidate) => candidate.id !== rule.id))} type="button">Remove</button>
                    </div>
                  ))}
                  <button
                    data-testid="kanban-add-rule"
                    onClick={() => setKanbanAutomations((current) => [...current, { id: `rule-${Date.now()}`, whenColumn: "doing" }])}
                    type="button"
                  >
                    Add rule
                  </button>
                </div>
              )}
            </div>
            {boardViewers.length > 0 && (
              <span className="do-kanban-viewers" data-testid="kanban-viewers">
                {boardViewers.map((viewer) => (
                  <em className="is-live" key={viewer.id} title={viewer.displayName}>{viewer.displayName.slice(0, 1)}</em>
                ))}
                viewing
              </span>
            )}
          </div>
        )}
        <div className="do-items-toolbar-actions">
          <div className="do-popover-anchor">
            <button
              aria-expanded={viewsOpen}
              aria-label="Views"
              className={`do-items-toolbar-icon do-mobile-advanced ${viewsOpen ? "is-active" : ""}`}
              onClick={() => { setViewsOpen((o) => !o); setFilterOpen(false); setSortOpen(false); setFieldsOpen(false); }}
              title="Views"
              type="button"
            >
              <LayoutGrid size={14} />
            </button>
            {viewsOpen && (
              <div className="do-popover do-items-views-popover" role="menu">
                <button onClick={() => { setGroupBy("hierarchy"); setPrimarySort("priority"); setSecondarySort("due"); setMode("list"); setViewsOpen(false); }} type="button">Epic hierarchy</button>
                <button onClick={() => { setGroupBy("hierarchy"); setPrimarySort("priority"); setSecondarySort("due"); setMode("calendar"); setViewsOpen(false); }} type="button">Calendar week</button>
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
              className={`do-items-toolbar-icon do-mobile-advanced ${fieldsOpen ? "is-active" : ""}`}
              data-testid="item-fields-button"
              onClick={() => { setFieldsOpen((o) => !o); setViewsOpen(false); setFilterOpen(false); setSortOpen(false); }}
              title="Fields"
              type="button"
            >
              <Settings2 size={14} />
            </button>
            {fieldsOpen && (
              <div className="do-popover do-fields-popover" data-testid="item-fields-picker" role="menu">
                <strong>Item fields</strong>
                <span>Choose which attribute icons appear beside each title. Empty fields stay faded; filters still use every field.</span>
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
            <button
              aria-expanded={filterOpen}
              aria-label="Filter"
              className={`do-items-toolbar-icon ${activeFilterChips.length || filterOpen ? "is-active" : ""}`}
              onClick={() => { setFilterOpen((o) => !o); setSortOpen(false); setViewsOpen(false); setFieldsOpen(false); }}
              title="Filter"
              type="button"
            >
              <SlidersHorizontal size={14} />
              {activeFilterChips.length > 0 && <em>{activeFilterChips.length}</em>}
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
            <button
              aria-expanded={sortOpen}
              aria-label="Sort"
              className={`do-items-toolbar-icon do-mobile-advanced ${sortOpen ? "is-active" : ""}`}
              onClick={() => { setSortOpen((o) => !o); setFilterOpen(false); setViewsOpen(false); setFieldsOpen(false); }}
              title="Sort"
              type="button"
            >
              <ArrowUpDown size={14} />
            </button>
            {sortOpen && (
              <div className="do-popover">
                <label>Group by<select aria-label="Group by" onChange={(event) => setGroupBy(event.target.value as GroupBy)} value={groupBy}><option value="hierarchy">Hierarchy</option><option value="actionBoard">Action Board</option><option value="status">Status</option><option value="priority">Priority</option><option value="project">Project</option><option value="owner">Owner</option><option value="type">Type</option><option value="work_category">Work Category</option><option value="product_phase">Product Phase</option><option value="tag">Tag</option><option value="due">Due date</option></select></label>
                <label>Primary sort<select aria-label="Primary sort" onChange={(event) => setPrimarySort(event.target.value as SortBy)} value={primarySort}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label>Then sort<select aria-label="Secondary sort" onChange={(event) => setSecondarySort(event.target.value as SortBy)} value={secondarySort}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>
            )}
          </div>
          <button aria-label="Add item" className="do-button do-button-dark" onClick={() => { setAddItemOpen((o) => !o); setCreateAttr(null); }} type="button"><Plus size={13} /> Add item</button>
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
        <section className="do-items-create is-quick-attrs" data-testid="item-create-form">
          <div className="do-item-attrs do-items-create-attrs">
            {(() => {
              const projectLabel = activeProject
                ? projectTitle(activeProject)
                : newProjectId
                  ? projectTitle(projects.find((project) => project.id === newProjectId) || { title: "Project" })
                  : "No project / errand";
              const TypeIcon = WORK_ITEM_TYPE_ICONS[newType] || Target;
              const parentLabel = newParentId
                ? title(parentOptions.find((item) => item.id === newParentId) || { title: "Parent" })
                : newType === "epic"
                  ? "No parent"
                  : `Choose ${allowedParentKinds(newType).map((kind) => workItemLabel(kind)).join(" or ")}`;
              const assigneeLabel = newAssigneeId
                ? memberName(workspaceMembers.find((member) => member.id === newAssigneeId) || { id: newAssigneeId })
                : "Unassigned";
              const deliveryLabel = newDeliveryEntity || "Delivery entity";
              const open = (key: string) => createAttr === key;
              const toggle = (key: string) => {
                setOpenAttr(null);
                setCreateAttr((current) => (current === key ? null : key));
              };
              return (
                <>
                  <div className={`do-item-attr ${newProjectId || activeProject ? "is-on" : "is-off"} ${open("project") ? "is-open" : ""}`}>
                    <button
                      aria-expanded={open("project")}
                      aria-label={`Project: ${projectLabel}`}
                      className="do-item-attr-btn"
                      data-testid="item-create-project"
                      disabled={Boolean(activeProject)}
                      onClick={() => toggle("project")}
                      title={`Project: ${projectLabel}`}
                      type="button"
                    >
                      <Folder size={13} />
                    </button>
                    {open("project") && (
                      <div className="do-item-attr-pop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <strong>Project</strong>
                        <select
                          aria-label="New item project"
                          disabled={Boolean(activeProject)}
                          onChange={(event) => { setNewProjectId(event.target.value); setCreateAttr(null); }}
                          value={newProjectId}
                        >
                          <option value="">{activeProject ? projectTitle(activeProject) : "No project / errand"}</option>
                          {projects.map((project) => <option key={project.id} value={project.id}>{projectTitle(project)}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className={`do-item-attr is-on ${open("type") ? "is-open" : ""}`}>
                    <button
                      aria-expanded={open("type")}
                      aria-label={`Type: ${workItemLabel(newType)}`}
                      className="do-item-attr-btn"
                      data-testid="item-create-type"
                      onClick={() => toggle("type")}
                      title={`Type: ${workItemLabel(newType)}`}
                      type="button"
                    >
                      <TypeIcon size={13} />
                    </button>
                    {open("type") && (
                      <div className="do-item-attr-pop do-items-create-type-pop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <strong>Type</strong>
                        <div className="do-items-create-type-grid">
                          {workTypes.map((kind) => {
                            const Icon = WORK_ITEM_TYPE_ICONS[kind] || Target;
                            return (
                              <button
                                aria-label={workItemLabel(kind)}
                                className={kind === newType ? "is-active" : ""}
                                key={kind}
                                onClick={() => { setNewType(kind); setNewParentId(""); setCreateAttr(null); }}
                                title={workItemLabel(kind)}
                                type="button"
                              >
                                <Icon size={13} />
                                <span>{workItemLabel(kind)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`do-item-attr is-parent ${newParentId ? "is-on" : "is-off"} ${open("parent") ? "is-open" : ""}`}>
                    <button
                      aria-expanded={open("parent")}
                      aria-label={`Parent: ${parentLabel}`}
                      className="do-item-attr-btn"
                      data-testid="item-create-parent"
                      disabled={newType === "epic"}
                      onClick={() => toggle("parent")}
                      title={`Parent: ${parentLabel}`}
                      type="button"
                    >
                      <GitBranch size={13} />
                    </button>
                    {open("parent") && (
                      <div className="do-item-attr-pop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <strong>Parent</strong>
                        <select
                          aria-label="New item parent"
                          disabled={newType === "epic"}
                          onChange={(event) => { setNewParentId(event.target.value); setCreateAttr(null); }}
                          value={newParentId}
                        >
                          <option value="">{newType === "epic" ? "No parent" : `Choose ${allowedParentKinds(newType).map((kind) => workItemLabel(kind)).join(" or ")}`}</option>
                          {parentOptions.map((item) => <option key={item.id} value={item.id}>{workItemLabel(workItemKind(item))} · {title(item)}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className={`do-item-attr ${newDueDate ? "is-on" : "is-off"} ${open("due") ? "is-open" : ""}`}>
                    <button
                      aria-expanded={open("due")}
                      aria-label={`Due date${newDueDate ? `: ${newDueDate}` : ""}`}
                      className="do-item-attr-btn"
                      data-testid="item-create-due-btn"
                      onClick={() => toggle("due")}
                      title={newDueDate ? `Due: ${newDueDate}` : "Due date"}
                      type="button"
                    >
                      <Calendar size={13} />
                    </button>
                    {open("due") && (
                      <div className="do-item-attr-pop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <strong>Due date</strong>
                        <input
                          aria-label="New item due date"
                          data-testid="item-create-due"
                          onChange={(event) => setNewDueDate(event.target.value)}
                          type="date"
                          value={newDueDate}
                        />
                      </div>
                    )}
                  </div>
                  <div className={`do-item-attr ${newAssigneeId ? "is-on" : "is-off"} ${open("assignee") ? "is-open" : ""}`}>
                    <button
                      aria-expanded={open("assignee")}
                      aria-label={`Assignee: ${assigneeLabel}`}
                      className="do-item-attr-btn"
                      data-testid="item-create-assignee-btn"
                      onClick={() => toggle("assignee")}
                      title={`Assignee: ${assigneeLabel}`}
                      type="button"
                    >
                      <User size={13} />
                    </button>
                    {open("assignee") && (
                      <div className="do-item-attr-pop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <strong>Assignee</strong>
                        <select
                          aria-label="New item assignee"
                          data-testid="item-create-assignee"
                          onChange={(event) => { setNewAssigneeId(event.target.value); setCreateAttr(null); }}
                          value={newAssigneeId}
                        >
                          <option value="">Unassigned</option>
                          {workspaceMembers.filter((member) => String(member.status || "active") !== "removed").map((member) => (
                            <option key={member.id} value={member.id}>{memberName(member)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className={`do-item-attr ${newPriority && newPriority !== "N/A" ? "is-on" : "is-off"} ${open("priority") ? "is-open" : ""}`}>
                    <button
                      aria-expanded={open("priority")}
                      aria-label={`Priority: ${newPriority}`}
                      className="do-item-attr-btn"
                      data-testid="item-create-priority-btn"
                      onClick={() => toggle("priority")}
                      title={`Priority: ${newPriority}`}
                      type="button"
                    >
                      <Flag size={13} />
                    </button>
                    {open("priority") && (
                      <div className="do-item-attr-pop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <strong>Priority</strong>
                        <select
                          aria-label="New item priority"
                          data-testid="item-create-priority"
                          onChange={(event) => { setNewPriority(event.target.value); setCreateAttr(null); }}
                          value={newPriority}
                        >
                          {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className={`do-item-attr ${newDeliveryEntity ? "is-on" : "is-off"} ${open("delivery") ? "is-open" : ""}`}>
                    <button
                      aria-expanded={open("delivery")}
                      aria-label={`Delivery entity: ${deliveryLabel}`}
                      className="do-item-attr-btn"
                      data-testid="item-create-delivery-btn"
                      onClick={() => toggle("delivery")}
                      title={`Delivery: ${deliveryLabel}`}
                      type="button"
                    >
                      <Globe size={13} />
                    </button>
                    {open("delivery") && (
                      <div className="do-item-attr-pop" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <strong>Delivery entity</strong>
                        <select
                          aria-label="New item delivery entity"
                          data-testid="item-create-delivery"
                          onChange={(event) => { setNewDeliveryEntity(event.target.value); setCreateAttr(null); }}
                          value={newDeliveryEntity}
                        >
                          <option value="">Delivery entity</option>
                          {deliveryEntityOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          <div className="do-ai-create-field">
            <input
              aria-label="New work item title"
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && createItem()}
              placeholder={`Add ${workItemLabel(newType)}...`}
              value={newTitle}
            />
            <AiRewriteButton
              context={{ itemType: newType, project: currentProject ? projectTitle(currentProject) : "No project" }}
              fieldKind="work_item_title"
              onRewrite={setNewTitle}
              text={newTitle}
            />
          </div>
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
          {renderSelectAll("items-select-all-bulk")}
          <button onClick={() => setSelectedBulkIds([])} type="button">Clear</button>
          <select aria-label="Bulk status" onChange={(event) => setBulkStatus(event.target.value)} value={bulkStatus}>{workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select>
          <button onClick={() => updateBulk({ status: bulkStatus })} type="button">Apply status</button>
          <select aria-label="Bulk priority" onChange={(event) => setBulkPriority(event.target.value)} value={bulkPriority}>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
          <button onClick={() => updateBulk({ priority: bulkPriority === "N/A" ? null : bulkPriority })} type="button">Apply priority</button>
          <input aria-label="Bulk due date" onChange={(event) => setBulkDueDate(event.target.value)} type="date" value={bulkDueDate} />
          <button onClick={() => updateBulk({ dueDate: bulkDueDate || null })} type="button">Apply date</button>
          <button onClick={() => updateBulk({ dueDate: null })} type="button">Clear date</button>
          <select aria-label="Bulk assignee" onChange={(event) => setBulkAssigneeId(event.target.value)} value={bulkAssigneeId}>
            <option value="">Assignee</option>
            <option value="none">Unassigned</option>
            {workspaceMembers.filter((member) => String(member.status || "active") !== "removed").map((member) => (
              <option key={member.id} value={member.id}>{memberName(member)}</option>
            ))}
          </select>
          <button
            disabled={!bulkAssigneeId}
            onClick={() => {
              if (bulkAssigneeId === "none") {
                updateBulk({
                  assigneeIds: [],
                  assignees: [],
                  owner: "",
                  assignee: "",
                });
                return;
              }
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
            {bulkAssigneeId === "none" ? "Unassign" : "Assign"}
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

      <div className="do-items-layout">
        <section className={`do-items-workspace is-${mode}`}>
          <div className="do-items-summary">
            {filtered.length > 0 && (
              <button
                className="do-items-select-all-label"
                data-testid="items-select-all-summary"
                disabled={visibleBulkIds.length === 0}
                onClick={toggleSelectAllVisible}
                type="button"
              >
                <span className={selectAllClass} aria-hidden="true">{selectAllIcon}</span>
                Select all
              </button>
            )}
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
          {mode === "flow" ? renderAnalytics() : mode === "gantt" ? renderGantt() : mode === "epics" ? renderGantt(filtered.filter((item) => workItemKind(item) === "epic")) : mode === "kanban" ? renderKanban() : mode === "calendar" ? renderCalendar() : groupBy === "hierarchy" ? renderHierarchy() : (
            <div className="do-items-groups">
              {Object.entries(grouped).sort(([left], [right]) => {
                const leftIndex = groupSortIndex(groupBy, left);
                const rightIndex = groupSortIndex(groupBy, right);
                if (leftIndex !== rightIndex) return leftIndex - rightIndex;
                return left.localeCompare(right);
              }).map(([group, items]) => (
                <section className="do-items-group" key={group}>
                  <button className="do-items-section-head" onClick={() => toggleGroup(group)} type="button"><ChevronDown className={collapsedGroups.includes(group) ? "is-collapsed" : ""} size={13} /><strong>{group}</strong><span>{items.length}</span></button>
                  {!collapsedGroups.includes(group) && renderForest(items)}
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

        {selectedItem && createPortal(
          <div
            className="do-item-modal-backdrop"
            data-testid="item-expanded-modal"
            onClick={() => onSelectItem(null)}
          >
            <aside
              aria-label={`${workItemLabel(workItemKind(selectedItem))} expanded view`}
              className="do-item-detail do-item-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
            <div className="do-item-detail-head">
              <select
                aria-label="Item type"
                data-testid="item-assign-type"
                onChange={(event) => changeItemType(selectedItem, event.target.value as WorkItemKind)}
                value={workItemKind(selectedItem)}
              >
                {workTypes.map((kind) => (
                  <option key={kind} value={kind}>{workItemLabel(kind)}</option>
                ))}
              </select>
              <div className="do-item-detail-head-actions">
                {renderDeleteButton(selectedItem)}
                <button aria-label="Close item detail" className="do-icon-button" onClick={() => onSelectItem(null)} title="Close" type="button"><X size={14} /></button>
              </div>
            </div>
            <div className="do-ai-inline-field"><InlineText ariaLabel="Selected item title" onCommit={(next) => next && onUpdateTask(selectedItem.id, { title: next })} value={title(selectedItem)} /><AiRewriteButton context={{ itemType: workItemKind(selectedItem), project: currentProject ? projectTitle(currentProject) : "No project" }} fieldKind="work_item_title" onRewrite={(next) => onUpdateTask(selectedItem.id, { title: next })} text={title(selectedItem)} /></div>
            <div className="do-ai-description-field"><textarea
              aria-label="Selected item description"
              onBlur={() => detailDescription !== String(selectedItem.description || selectedItem.definitionOfDone || "") && onUpdateTask(selectedItem.id, { description: detailDescription })}
              onChange={(event) => setDetailDescription(event.target.value)}
              placeholder="Description, acceptance criteria, notes..."
              value={detailDescription}
            /><AiRewriteButton context={{ itemTitle: title(selectedItem), itemType: workItemKind(selectedItem), project: currentProject ? projectTitle(currentProject) : "No project" }} fieldKind="work_item_description" onRewrite={(next) => { setDetailDescription(next); return onUpdateTask(selectedItem.id, { description: next }); }} text={detailDescription} /></div>
            <label>Status<select onChange={(event) => {
              const nextStatus = event.target.value;
              if (rejectWipMove(selectedItem, kanbanColumnForStatus(nextStatus))) return;
              onUpdateTask(selectedItem.id, { status: nextStatus, statusHistory: appendStatusHistory(selectedItem, nextStatus, kanbanColumnForStatus(nextStatus)), completedAt: nextStatus === "done" ? selectedItem.completedAt || new Date().toISOString() : null });
            }} value={canonicalStatus(selectedItem)}>{workStatuses.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select></label>
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
            <div className="do-item-parent-field">
              <span>Parent</span>
              {renderParentEditor(selectedItem)}
            </div>
            <div className="do-item-estimate-row">
              <label>Story points<input aria-label="Story points" inputMode="numeric" onBlur={(event) => onUpdateTask(selectedItem.id, { storyPoints: event.target.value ? Number(event.target.value) : null })} defaultValue={selectedItem.storyPoints ?? ""} type="number" /></label>
              <label>Estimate (h)<input aria-label="Estimate hours" inputMode="decimal" onBlur={(event) => onUpdateTask(selectedItem.id, { estimateHours: event.target.value ? Number(event.target.value) : null })} defaultValue={selectedItem.estimateHours ?? ""} type="number" /></label>
              <label>Logged (h)<input aria-label="Logged hours" inputMode="decimal" onBlur={(event) => onUpdateTask(selectedItem.id, { loggedHours: event.target.value ? Number(event.target.value) : null })} defaultValue={selectedItem.loggedHours ?? ""} type="number" /></label>
            </div>
            <label>Repeat<select aria-label="Repeat item" onChange={(event) => onUpdateTask(selectedItem.id, { recurrenceType: event.target.value || "none", isRoutineTask: Boolean(event.target.value && event.target.value !== "none"), recurrenceStatus: event.target.value && event.target.value !== "none" ? "active" : "ended" })} value={selectedItem.recurrenceType || "none"}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="workdays">Workdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            <section className="do-item-checklist" data-testid="item-checklist">
              <strong>Checklist</strong>
              {checklistItems(selectedItem).length > 0 && (
                <span className="do-kanban-progress" data-testid="item-checklist-progress" title="Checklist">
                  <i style={{ width: `${checklistProgress(checklistItems(selectedItem)).percent}%` }} />
                  <em>{checklistCaption(checklistItems(selectedItem))}</em>
                </span>
              )}
              {checklistItems(selectedItem).map((entry) => (
                <label key={entry.id}>
                  <input
                    checked={entry.done}
                    onChange={() => onUpdateTask(selectedItem.id, {
                      checklist: checklistItems(selectedItem).map((candidate) => candidate.id === entry.id ? { ...candidate, done: !candidate.done } : candidate),
                    })}
                    type="checkbox"
                  />
                  <span>{entry.text}</span>
                  <button
                    aria-label={`Remove ${entry.text}`}
                    onClick={() => onUpdateTask(selectedItem.id, {
                      checklist: checklistItems(selectedItem).filter((candidate) => candidate.id !== entry.id),
                    })}
                    type="button"
                  >
                    <X size={12} />
                  </button>
                </label>
              ))}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = checklistDraft.trim();
                  if (!text) return;
                  onUpdateTask(selectedItem.id, {
                    checklist: [...checklistItems(selectedItem), newChecklistItem(text, checklistItems(selectedItem))],
                  });
                  setChecklistDraft("");
                }}
              >
                <input
                  aria-label="Add checklist item"
                  onChange={(event) => setChecklistDraft(event.target.value)}
                  placeholder="Add a checklist item"
                  value={checklistDraft}
                />
              </form>
            </section>
            <section className="do-item-comments" data-testid="item-comments">
              <strong>Activity</strong>
              {activityThread(selectedItem).map((entry) => (
                <article className={entry.kind === "system" ? "is-system" : "is-comment"} key={entry.id}>
                  <span>{entry.kind === "system" ? "System" : entry.author || "Teammate"} · {dateLabel(new Date(entry.at))}</span>
                  <p>
                    {mentionSegments(entry.text).map((part, index) => (
                      part.mention
                        ? <em className="is-mention" key={`${entry.id}-${index}`}>{part.text}</em>
                        : <Fragment key={`${entry.id}-${index}`}>{part.text}</Fragment>
                    ))}
                  </p>
                </article>
              ))}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = commentDraft.trim();
                  if (!text) return;
                  const author = workspaceMembers.find((member) => member.userId === viewerId || member.id === viewerId);
                  const next: KanbanComment = {
                    id: `comment-${Date.now()}`,
                    at: new Date().toISOString(),
                    author: author ? memberName(author) : "Me",
                    text,
                  };
                  onUpdateTask(selectedItem.id, {
                    comments: [...(Array.isArray(selectedItem.comments) ? selectedItem.comments : []), next],
                    mentionedNames: mentionNames(text),
                  });
                  setCommentDraft("");
                }}
              >
                <input
                  aria-label="Add a comment"
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Comment and @mention a teammate"
                  value={commentDraft}
                />
              </form>
              {commentMentionsViewer(commentDraft, owners.concat(workspaceMembers.map((member) => memberName(member)))) && (
                <small>This will notify the mentioned teammate in the board activity.</small>
              )}
              {extractUrls(detailDescription).map((url) => <a href={url} key={url} rel="noreferrer" target="_blank">{url}</a>)}
            </section>
            <div className="do-item-detail-actions">
              {currentProject && <button onClick={() => onOpenProjectConsole(currentProject)} type="button"><Folder size={13} /> Console</button>}
              {allowedParentKinds(workItemKind(selectedItem)).length > 0 && (
                <button
                  aria-label="Assign parent"
                  data-testid="item-assign-parent"
                  onClick={() => {
                    setParentSearch("");
                    const field = document.querySelector<HTMLElement>('[data-testid="item-parent-field"]');
                    field?.scrollIntoView({ block: "center" });
                    field?.querySelector("input")?.focus();
                  }}
                  type="button"
                >
                  <GitBranch size={13} /> Parent
                </button>
              )}
              <button onClick={() => onAsk(`Help me move this work item forward: ${title(selectedItem)}`)} type="button"><ArrowRight size={13} /> Ask</button>
            </div>
            </aside>
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}
