export const RECENT_ITEMS_KEY = "certo-recent-items";
export const RECENT_ITEMS_LIMIT = 8;

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type PaletteTaskRow = {
  id: string;
  title: string;
  key: string;
  projectId: string;
  projectName: string;
};

export type WorkItemPaletteEntry = {
  id: string;
  taskId: string;
  label: string;
  keywords: string;
  hint: string;
  group: "Recent" | "Items";
};

export function isRemovedWorkItem(row: {
  status?: unknown;
  archived?: unknown;
  deleted?: unknown;
  deletedAt?: unknown;
}) {
  if (row.archived || row.deleted || row.deletedAt) return true;
  const status = String(row.status || "").toLowerCase();
  return status === "archived" || status === "deleted";
}

export function paletteTaskSearchText(task: PaletteTaskRow) {
  return [task.title, task.key, task.id, task.projectName].filter(Boolean).join(" ").toLowerCase();
}

export function paletteTaskMatches(task: PaletteTaskRow, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return paletteTaskSearchText(task).includes(needle);
}

function storeOr(store?: KeyValueStore | null) {
  if (store) return store;
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function readRecentItemIds(store?: KeyValueStore | null): string[] {
  try {
    const raw = storeOr(store)?.getItem(RECENT_ITEMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id || "")).filter(Boolean).slice(0, RECENT_ITEMS_LIMIT);
  } catch {
    return [];
  }
}

export function rememberRecentItem(id: string, store?: KeyValueStore | null): string[] {
  const next = [id, ...readRecentItemIds(store).filter((row) => row !== id)].slice(0, RECENT_ITEMS_LIMIT);
  try {
    storeOr(store)?.setItem(RECENT_ITEMS_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function buildWorkItemPaletteEntries(input: {
  tasks: PaletteTaskRow[];
  recentIds: string[];
}): WorkItemPaletteEntry[] {
  const byId = new Map(input.tasks.map((task) => [task.id, task]));
  const recent: WorkItemPaletteEntry[] = [];
  for (const id of input.recentIds) {
    const task = byId.get(id);
    if (!task) continue;
    recent.push({
      id: `recent-item-${task.id}`,
      taskId: task.id,
      label: task.title || task.key || task.id,
      keywords: paletteTaskSearchText(task),
      hint: task.projectName,
      group: "Recent",
    });
  }
  const recentIds = new Set(recent.map((entry) => entry.taskId));
  const items = input.tasks
    .filter((task) => !recentIds.has(task.id))
    .map((task) => ({
      id: `item-${task.id}`,
      taskId: task.id,
      label: task.title || task.key || task.id,
      keywords: paletteTaskSearchText(task),
      hint: task.projectName,
      group: "Items" as const,
    }));
  return [...recent, ...items];
}
