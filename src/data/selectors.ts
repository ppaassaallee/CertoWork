import { isRemovedWorkItem } from "../lib/commandSearch";
import { useDocSelector } from "./createDocStore";
import {
  conversationsStore,
  projectsStore,
  tasksStore,
  type ConversationDoc,
  type ProjectDoc,
  type TaskDoc,
} from "./collections";

const PALETTE_TASK_CAP = 300;
const PALETTE_PROJECT_CAP = 200;

function textField(row: { [key: string]: unknown }, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function flagField(row: { [key: string]: unknown }, key: string) {
  return Boolean(row[key]);
}

function recency(row: { [key: string]: unknown }) {
  const updated = row.updatedAt;
  if (typeof updated === "number") return updated;
  if (typeof updated === "string") return Date.parse(updated) || 0;
  if (updated && typeof updated === "object") {
    if ("toMillis" in updated && typeof updated.toMillis === "function") return updated.toMillis();
    if ("seconds" in updated && typeof updated.seconds === "number") return updated.seconds * 1000;
  }
  return 0;
}

function isClosedStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  return ["done", "completed", "closed", "archived", "cancelled", "canceled"].includes(value);
}

export type SidebarProjectRow = {
  id: string;
  title: string;
  name: string;
  status?: string;
  updatedAt?: unknown;
  favorite: boolean;
  isFavorite: boolean;
  starred: boolean;
  health: string;
  healthOverride: string;
  healthStatus: string;
  importedFrom: string;
  dueDate: string;
  revisedDueDate: string;
  targetDate: string;
  originalDueDate: string;
};

/** Lightweight sidebar rows — shell can subscribe without pulling full project arrays. */
export function useSidebarProjects() {
  return useDocSelector(
    projectsStore,
    (rows) =>
      rows
        .filter((row) => !isClosedStatus(row.status))
        .map((row) => ({
          id: row.id,
          title: textField(row, "title") || textField(row, "name") || "Project",
          name: textField(row, "name") || textField(row, "title"),
          status: row.status,
          updatedAt: row.updatedAt,
          favorite: flagField(row, "favorite"),
          isFavorite: flagField(row, "isFavorite"),
          starred: flagField(row, "starred"),
          health: textField(row, "health"),
          healthOverride: textField(row, "healthOverride"),
          healthStatus: textField(row, "healthStatus"),
          importedFrom: textField(row, "importedFrom"),
          dueDate: textField(row, "dueDate"),
          revisedDueDate: textField(row, "revisedDueDate"),
          targetDate: textField(row, "targetDate"),
          originalDueDate: textField(row, "originalDueDate"),
        })),
    (a, b) =>
      a.length === b.length &&
      a.every(
        (row, i) =>
          row.id === b[i].id &&
          row.title === b[i].title &&
          row.name === b[i].name &&
          row.status === b[i].status &&
          row.updatedAt === b[i].updatedAt &&
          row.favorite === b[i].favorite &&
          row.isFavorite === b[i].isFavorite &&
          row.starred === b[i].starred &&
          row.health === b[i].health &&
          row.healthOverride === b[i].healthOverride &&
          row.dueDate === b[i].dueDate &&
          row.revisedDueDate === b[i].revisedDueDate,
      ),
  );
}

export type PaletteProjectRow = {
  id: string;
  title: string;
  client: string;
  delivery: string;
  projectKey: string;
  serviceLine: string;
  category: string;
  phase: string;
};

export function usePaletteProjects() {
  return useDocSelector(
    projectsStore,
    (rows) =>
      rows
        .filter((row) => !isClosedStatus(row.status))
        .slice(0, PALETTE_PROJECT_CAP)
        .map((row) => ({
          id: row.id,
          title: textField(row, "title") || textField(row, "name") || "Untitled",
          client: textField(row, "clientEntity") || textField(row, "client"),
          delivery: textField(row, "deliveryEntity") || textField(row, "bpo"),
          projectKey: textField(row, "projectKey"),
          serviceLine: textField(row, "serviceLine"),
          category: textField(row, "workCategory"),
          phase: textField(row, "productPhase"),
        })),
    (a, b) =>
      a.length === b.length &&
      a.every(
        (row, i) =>
          row.id === b[i].id &&
          row.title === b[i].title &&
          row.client === b[i].client &&
          row.projectKey === b[i].projectKey,
      ),
  );
}

export type PaletteTaskRow = {
  id: string;
  title: string;
  key: string;
  projectId: string;
  status: string;
};

export function usePaletteTasks() {
  return useDocSelector(
    tasksStore,
    (rows) =>
      rows
        .filter((row) => !isRemovedWorkItem({
          status: row.status,
          archived: row.archived,
          deleted: row.deleted,
          deletedAt: row.deletedAt,
        }))
        .slice()
        .sort((left, right) => recency(right) - recency(left))
        .slice(0, PALETTE_TASK_CAP)
        .map((row) => ({
          id: row.id,
          title: textField(row, "title") || textField(row, "name") || "Untitled",
          key: textField(row, "key") || textField(row, "workItemKey"),
          projectId: textField(row, "projectId"),
          status: textField(row, "status"),
        })),
    (a, b) =>
      a.length === b.length &&
      a.every(
        (row, i) =>
          row.id === b[i].id &&
          row.title === b[i].title &&
          row.key === b[i].key &&
          row.projectId === b[i].projectId &&
          row.status === b[i].status,
      ),
  );
}

export function useFavoriteProjects(favoriteIds: string[]) {
  const key = favoriteIds.slice().sort().join("|");
  return useDocSelector(
    projectsStore,
    (rows) => {
      if (!key) return [] as ProjectDoc[];
      const set = new Set(key.split("|").filter(Boolean));
      return rows.filter((row) => set.has(row.id));
    },
    (a, b) => a === b || (a.length === b.length && a.every((row, i) => row === b[i])),
  );
}

export function useConversation(id: string | null | undefined) {
  return useDocSelector(
    conversationsStore,
    (rows) => (id ? rows.find((row) => row.id === id) || null : null) as ConversationDoc | null,
  );
}

export function useTask(id: string | null | undefined) {
  return useDocSelector(
    tasksStore,
    (rows) => (id ? rows.find((row) => row.id === id) || null : null) as TaskDoc | null,
  );
}

/** Open-task counts per project for sidebar badges — ignores unrelated task field churn when counts stable. */
export function useOpenTaskCountByProject() {
  return useDocSelector(
    tasksStore,
    (rows) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        if (isClosedStatus(row.status)) continue;
        const pid = String(row.projectId || "");
        if (!pid) continue;
        map.set(pid, (map.get(pid) || 0) + 1);
      }
      return map;
    },
    (a, b) => {
      if (a === b) return true;
      if (a.size !== b.size) return false;
      for (const [k, v] of a) if (b.get(k) !== v) return false;
      return true;
    },
  );
}

export function getProjectsSnapshot() {
  return projectsStore.getSnapshot();
}

export function getTasksSnapshot() {
  return tasksStore.getSnapshot();
}
