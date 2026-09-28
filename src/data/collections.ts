import { createDocStore, useDocSelector, useDocStore, type DocRow } from "./createDocStore";

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

export function useTasks() {
  return useDocStore(tasksStore);
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
    (rows) => (projectId ? rows.filter((row) => row.projectId === projectId) : []),
    (a, b) => a === b || (a.length === b.length && a.every((row, i) => row === b[i])),
  );
}

const EMPTY_TASK_INDEX = new Map<string, TaskDoc[]>();

export function useTasksIndex() {
  return useDocSelector(
    tasksStore,
    (rows) => {
      const map = new Map<string, TaskDoc[]>();
      for (const row of rows) {
        const id = String(row.projectId || "");
        if (!id) continue;
        const list = map.get(id);
        if (list) list.push(row);
        else map.set(id, [row]);
      }
      return map.size ? map : EMPTY_TASK_INDEX;
    },
    (a, b) => a === b,
  );
}

export function clearWorkspaceCollectionStores() {
  projectsStore.clear();
  tasksStore.clear();
  conversationsStore.clear();
  membersStore.clear();
}
