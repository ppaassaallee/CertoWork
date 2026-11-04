import { isCertoRunItem } from "../lib/certoRun/item";
import { createDocStore, sameDocSignature, useDocSelector, useDocStore, type DocRow } from "./createDocStore";

export type ProjectDoc = DocRow & {
  title?: string;
  name?: string;
  status?: string;
  workspaceId?: string;
};

export type TaskDoc = DocRow & {
  title?: string;
  projectId?: string;
  status?: string;
  workspaceId?: string;
  assigneeIds?: string[];
};

export type ConversationDoc = DocRow & {
  title?: string;
  workspaceId?: string;
  userId?: string;
  status?: string;
};

export type MemberDoc = DocRow & {
  userId?: string;
  workspaceId?: string;
  role?: string;
  email?: string;
  emailLower?: string;
  displayName?: string;
  alias?: string;
  portfolioViewer?: boolean;
};

export const projectsStore = createDocStore<ProjectDoc>();
export const tasksStore = createDocStore<TaskDoc>();
export const conversationsStore = createDocStore<ConversationDoc>();
export const membersStore = createDocStore<MemberDoc>();

export function useProjects() {
  return useDocStore(projectsStore);
}

function workItems(rows: TaskDoc[]) {
  return rows.filter((row) => !isCertoRunItem(row));
}

export function useTasks() {
  return useDocSelector(tasksStore, workItems, sameDocSignature);
}

export function useRunItems(workspaceId: string) {
  return useDocSelector(
    tasksStore,
    (rows) => rows.filter((row) => row.workspaceId === workspaceId && isCertoRunItem(row)),
    sameDocSignature,
  );
}

const EMPTY_TASKS: TaskDoc[] = [];

/**
 * Subscribe to tasks only while `enabled` is true. When false, returns a stable
 * empty array and ignores store emits — so the Projects portfolio shell does not
 * re-render on every task snapshot (My Work / Home / Project routes opt in).
 */
export function useTasksWhen(enabled: boolean) {
  return useDocSelector(
    tasksStore,
    (rows) => (enabled ? workItems(rows) : EMPTY_TASKS),
    (a, b) => {
      if (!enabled) return a === EMPTY_TASKS && b === EMPTY_TASKS;
      return sameDocSignature(a, b);
    },
  );
}

const EMPTY_PROJECTS: ProjectDoc[] = [];

/**
 * Subscribe to projects only while `enabled` is true. Routes that own
 * useProjects() (Home/MyWork/Projects/Project) keep the shell quiet.
 */
export function useProjectsWhen(enabled: boolean) {
  return useDocSelector(
    projectsStore,
    (rows) => (enabled ? rows : EMPTY_PROJECTS),
    (a, b) => {
      if (!enabled) return a === EMPTY_PROJECTS && b === EMPTY_PROJECTS;
      return a === b;
    },
  );
}

export function useConversations() {
  return useDocStore(conversationsStore);
}

export function useMembers() {
  return useDocStore(membersStore);
}

export function useProject(id: string | null | undefined) {
  return useDocSelector(projectsStore, (rows) =>
    id ? rows.find((row) => row.id === id) || null : null,
  );
}

export function useTasksByProject(projectId: string | null | undefined) {
  return useDocSelector(
    tasksStore,
    (rows) => (projectId ? workItems(rows).filter((row) => row.projectId === projectId) : []),
    (a, b) => a === b || (a.length === b.length && a.every((row, i) => row === b[i])),
  );
}

const EMPTY_TASK_INDEX = new Map<string, TaskDoc[]>();

function sameTaskIndex(
  a: Map<string, TaskDoc[]>,
  b: Map<string, TaskDoc[]>,
): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [projectId, list] of a) {
    const other = b.get(projectId);
    if (!other || other.length !== list.length) return false;
    if (!other.every((row, i) => row === list[i])) return false;
  }
  return true;
}

/**
 * ProjectId → tasks index for ProjectRoute.
 * Equality must be content-based: the selector always builds a fresh Map, and
 * useSyncExternalStore infinite-loops if getSnapshot returns a new ref each call
 * (React: "The result of getSnapshot should be cached").
 */
export function useTasksIndex() {
  return useDocSelector(
    tasksStore,
    (rows) => {
      const map = new Map<string, TaskDoc[]>();
      for (const row of workItems(rows)) {
        const id = String(row.projectId || "");
        if (!id) continue;
        const list = map.get(id);
        if (list) list.push(row);
        else map.set(id, [row]);
      }
      return map.size ? map : EMPTY_TASK_INDEX;
    },
    sameTaskIndex,
  );
}

export function clearWorkspaceCollectionStores() {
  projectsStore.clear();
  tasksStore.clear();
  conversationsStore.clear();
  membersStore.clear();
}
