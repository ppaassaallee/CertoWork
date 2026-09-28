import { useDocSelector } from "./createDocStore";
import {
  conversationsStore,
  projectsStore,
  tasksStore,
  type ConversationDoc,
  type ProjectDoc,
  type TaskDoc,
} from "./collections";

function isClosedStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  return ["done", "completed", "closed", "archived", "cancelled", "canceled"].includes(value);
}

/** Lightweight sidebar rows — shell can subscribe without pulling full task arrays. */
export function useSidebarProjects() {
  return useDocSelector(
    projectsStore,
    (rows) =>
      rows
        .filter((row) => !isClosedStatus(row.status))
        .map((row) => ({
          id: row.id,
          title: String(row.title || row.name || "Project"),
          status: row.status,
          updatedAt: row.updatedAt,
        })),
    (a, b) =>
      a.length === b.length &&
      a.every(
        (row, i) =>
          row.id === b[i].id &&
          row.title === b[i].title &&
          row.status === b[i].status &&
          row.updatedAt === b[i].updatedAt,
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
