import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  asAutomations,
  asColumnLabels,
  asKanbanSwimlane,
  asWipLimits,
  type KanbanAutomationRule,
  type KanbanSwimlaneBy,
} from "./kanbanFeatures";

export const ITEM_VIEW_PREFS_COLLECTION = "user_action_board_preferences";
export const LEGACY_NAMED_VIEWS_KEY = "certo-items-view-config";
export const LEGACY_COLUMNS_KEY = "certo-items-current-view-config";
export const LEGACY_WIDTHS_KEY = "certo-items-current-column-widths";

export type WorkItemsViewMode = "list" | "kanban" | "calendar" | "flow" | "gantt" | "epics";
export type ItemGroupBy =
  | "hierarchy"
  | "actionBoard"
  | "status"
  | "priority"
  | "project"
  | "owner"
  | "type"
  | "due"
  | "tag"
  | "work_category"
  | "product_phase";
export type ItemSortBy =
  | "rank"
  | "project"
  | "priority"
  | "due"
  | "title"
  | "status"
  | "owner"
  | "type"
  | "delivery_entity"
  | "client_entity"
  | "work_category"
  | "product_phase";
export type ItemColumnKey =
  | "title"
  | "project"
  | "delivery_entity"
  | "client_entity"
  | "tags"
  | "work_category"
  | "product_phase"
  | "status"
  | "priority"
  | "gtd"
  | "bucket"
  | "assignees"
  | "due"
  | "sprint";

export type ItemViewFilters = {
  mode: WorkItemsViewMode;
  projectFilter: string;
  statusFilter: string;
  priorityFilter: string;
  typeFilter: string;
  ownerFilter: string;
  dateFilter: string;
  tagFilter: string;
  workCategoryFilter: string;
  productPhaseFilter: string;
  groupBy: ItemGroupBy;
  primarySort: ItemSortBy;
  secondarySort: ItemSortBy;
  query: string;
  sprintFilter?: string;
};

export type ItemSavedView = {
  name: string;
  columns: ItemColumnKey[];
  widths?: Partial<Record<ItemColumnKey, number>>;
  kanbanWidths?: Record<string, number>;
  kanbanSwimlane?: KanbanSwimlaneBy;
  kanbanWipLimits?: Record<string, number>;
  kanbanColumnLabels?: Record<string, string>;
  kanbanAutomations?: KanbanAutomationRule[];
  filters?: Partial<ItemViewFilters>;
};

export type ItemViewSession = {
  columns: ItemColumnKey[];
  widths?: Partial<Record<ItemColumnKey, number>>;
  kanbanWidths?: Record<string, number>;
  kanbanSwimlane?: KanbanSwimlaneBy;
  kanbanWipLimits?: Record<string, number>;
  kanbanColumnLabels?: Record<string, string>;
  kanbanAutomations?: KanbanAutomationRule[];
  filters: ItemViewFilters;
};

export type ItemViewMemory = {
  views: ItemSavedView[];
  sessions: Record<string, ItemViewSession>;
};

const VIEW_MODES: WorkItemsViewMode[] = ["list", "kanban", "calendar", "flow", "gantt", "epics"];
const GROUP_BY: ItemGroupBy[] = [
  "hierarchy",
  "actionBoard",
  "status",
  "priority",
  "project",
  "owner",
  "type",
  "due",
  "tag",
  "work_category",
  "product_phase",
];
const SORT_BY: ItemSortBy[] = [
  "rank",
  "project",
  "priority",
  "due",
  "title",
  "status",
  "owner",
  "type",
  "delivery_entity",
  "client_entity",
  "work_category",
  "product_phase",
];
const COLUMN_KEYS: ItemColumnKey[] = [
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

export function itemViewSurface(projectId?: string | null) {
  return projectId ? `project:${projectId}` : "my-work";
}

export function itemViewPrefsDocId(userId: string, workspaceId: string) {
  return `${userId}_${workspaceId}`;
}

export function namedViewsStorageKey(userId: string) {
  return `certo-items-views:${userId}`;
}

export function lastSessionsStorageKey(userId: string) {
  return `certo-items-last:${userId}`;
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function asMode(value: unknown, fallback: WorkItemsViewMode): WorkItemsViewMode {
  return VIEW_MODES.includes(value as WorkItemsViewMode) ? (value as WorkItemsViewMode) : fallback;
}

function asGroup(value: unknown, fallback: ItemGroupBy): ItemGroupBy {
  return GROUP_BY.includes(value as ItemGroupBy) ? (value as ItemGroupBy) : fallback;
}

function asSort(value: unknown, fallback: ItemSortBy): ItemSortBy {
  return SORT_BY.includes(value as ItemSortBy) ? (value as ItemSortBy) : fallback;
}

function asColumns(value: unknown): ItemColumnKey[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const next = value.filter((column): column is ItemColumnKey =>
    COLUMN_KEYS.includes(column as ItemColumnKey),
  );
  return next.length ? next : null;
}

function asWidths(value: unknown): Partial<Record<ItemColumnKey, number>> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const next: Partial<Record<ItemColumnKey, number>> = {};
  for (const [key, width] of Object.entries(value as Record<string, unknown>)) {
    if (!COLUMN_KEYS.includes(key as ItemColumnKey)) continue;
    const numeric = Number(width);
    if (Number.isFinite(numeric)) next[key as ItemColumnKey] = numeric;
  }
  return Object.keys(next).length ? next : undefined;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function defaultItemViewFilters(projectId?: string | null): ItemViewFilters {
  return {
    mode: "list",
    projectFilter: projectId || "all",
    statusFilter: "open",
    priorityFilter: "all",
    typeFilter: "all",
    ownerFilter: "all",
    dateFilter: "all",
    tagFilter: "all",
    workCategoryFilter: "all",
    productPhaseFilter: "all",
    groupBy: "hierarchy",
    primarySort: "project",
    secondarySort: "priority",
    query: "",
    sprintFilter: "all",
  };
}

export function normalizeItemViewFilters(
  value: Partial<ItemViewFilters> | undefined,
  projectId?: string | null,
): ItemViewFilters {
  const fallback = defaultItemViewFilters(projectId);
  if (!value) return fallback;
  return {
    mode: asMode(value.mode, fallback.mode),
    projectFilter: projectId || asString(value.projectFilter, fallback.projectFilter),
    statusFilter: asString(value.statusFilter, fallback.statusFilter),
    priorityFilter: asString(value.priorityFilter, fallback.priorityFilter),
    typeFilter: asString(value.typeFilter, fallback.typeFilter),
    ownerFilter: asString(value.ownerFilter, fallback.ownerFilter),
    dateFilter: asString(value.dateFilter, fallback.dateFilter),
    tagFilter: asString(value.tagFilter, fallback.tagFilter),
    workCategoryFilter: asString(value.workCategoryFilter, fallback.workCategoryFilter),
    productPhaseFilter: asString(value.productPhaseFilter, fallback.productPhaseFilter),
    groupBy: asGroup(value.groupBy, fallback.groupBy),
    primarySort: asSort(value.primarySort, fallback.primarySort),
    secondarySort: asSort(value.secondarySort, fallback.secondarySort),
    query: typeof value.query === "string" ? value.query : "",
    sprintFilter: asString(value.sprintFilter, fallback.sprintFilter || "all"),
  };
}

function asKanbanWidths(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const next: Record<string, number> = {};
  for (const [key, width] of Object.entries(value as Record<string, unknown>)) {
    const numeric = Number(width);
    if (key && Number.isFinite(numeric)) next[key] = numeric;
  }
  return Object.keys(next).length ? next : undefined;
}

function normalizeSession(value: unknown, projectId?: string | null): ItemViewSession | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as ItemViewSession;
  return {
    columns: asColumns(raw.columns) || [],
    widths: asWidths(raw.widths),
    kanbanWidths: asKanbanWidths(raw.kanbanWidths),
    kanbanSwimlane: asKanbanSwimlane(raw.kanbanSwimlane),
    kanbanWipLimits: asWipLimits(raw.kanbanWipLimits),
    kanbanColumnLabels: asColumnLabels(raw.kanbanColumnLabels),
    kanbanAutomations: asAutomations(raw.kanbanAutomations),
    filters: normalizeItemViewFilters(raw.filters, projectId),
  };
}

function normalizeSavedView(value: unknown): ItemSavedView | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as ItemSavedView;
  const name = String(raw.name || "").trim();
  if (!name) return null;
  return {
    name,
    columns: asColumns(raw.columns) || [],
    widths: asWidths(raw.widths),
    kanbanWidths: asKanbanWidths(raw.kanbanWidths),
    kanbanSwimlane: asKanbanSwimlane(raw.kanbanSwimlane),
    kanbanWipLimits: asWipLimits(raw.kanbanWipLimits),
    kanbanColumnLabels: asColumnLabels(raw.kanbanColumnLabels),
    kanbanAutomations: asAutomations(raw.kanbanAutomations),
    filters: raw.filters ? normalizeItemViewFilters(raw.filters) : undefined,
  };
}

export function readNamedItemViews(userId: string): ItemSavedView[] {
  const scoped = readJson(namedViewsStorageKey(userId));
  const legacy = readJson(LEGACY_NAMED_VIEWS_KEY);
  const source = Array.isArray(scoped) && scoped.length ? scoped : legacy;
  if (!Array.isArray(source)) return [];
  return source.map(normalizeSavedView).filter(Boolean) as ItemSavedView[];
}

export function writeNamedItemViews(userId: string, views: ItemSavedView[]) {
  writeJson(namedViewsStorageKey(userId), views);
}

export function readLastItemSessions(userId: string): Record<string, ItemViewSession> {
  const scoped = readJson(lastSessionsStorageKey(userId));
  if (scoped && typeof scoped === "object" && !Array.isArray(scoped)) {
    const next: Record<string, ItemViewSession> = {};
    for (const [surface, session] of Object.entries(scoped as Record<string, unknown>)) {
      const projectId = surface.startsWith("project:") ? surface.slice("project:".length) : null;
      const normalized = normalizeSession(session, projectId);
      if (normalized) next[surface] = normalized;
    }
    if (Object.keys(next).length) return next;
  }
  const columns = asColumns(readJson(LEGACY_COLUMNS_KEY));
  const widths = asWidths(readJson(LEGACY_WIDTHS_KEY));
  if (!columns && !widths) return {};
  return {
    "my-work": {
      columns: columns || [],
      widths,
      filters: defaultItemViewFilters(null),
    },
  };
}

export function readLastItemSession(userId: string, surface: string): ItemViewSession | null {
  return readLastItemSessions(userId)[surface] || null;
}

export function writeLastItemSession(userId: string, surface: string, session: ItemViewSession) {
  const next = { ...readLastItemSessions(userId), [surface]: session };
  writeJson(lastSessionsStorageKey(userId), next);
  return next;
}

export function upsertNamedItemView(views: ItemSavedView[], nextView: ItemSavedView) {
  return [...views.filter((candidate) => candidate.name !== nextView.name), nextView];
}

export function itemViewPrefsRef(userId: string, workspaceId: string) {
  return doc(db, ITEM_VIEW_PREFS_COLLECTION, itemViewPrefsDocId(userId, workspaceId));
}

export async function pullRemoteItemViewMemory(
  userId: string,
  workspaceId: string,
): Promise<ItemViewMemory | null> {
  const snap = await getDoc(itemViewPrefsRef(userId, workspaceId));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  const views = Array.isArray(data.itemSavedViews)
    ? (data.itemSavedViews.map(normalizeSavedView).filter(Boolean) as ItemSavedView[])
    : [];
  const sessions: Record<string, ItemViewSession> = {};
  if (data.itemLastSessions && typeof data.itemLastSessions === "object") {
    for (const [surface, session] of Object.entries(data.itemLastSessions as Record<string, unknown>)) {
      const projectId = surface.startsWith("project:") ? surface.slice("project:".length) : null;
      const normalized = normalizeSession(session, projectId);
      if (normalized) sessions[surface] = normalized;
    }
  }
  if (!views.length && !Object.keys(sessions).length) return null;
  return { views, sessions };
}

export async function pushRemoteItemViewMemory(
  userId: string,
  workspaceId: string,
  memory: ItemViewMemory,
) {
  await setDoc(
    itemViewPrefsRef(userId, workspaceId),
    {
      userId,
      workspaceId,
      updatedAt: serverTimestamp(),
      itemSavedViews: memory.views,
      itemLastSessions: memory.sessions,
    },
    { merge: true },
  );
}
