import type { PlanItem } from "../types";

/** Wrap an already-loaded My Work item pool — never opens a second query. */
export function useMyItemsFromPool(items: PlanItem[]): {
  items: PlanItem[];
  loading: boolean;
} {
  return { items, loading: false };
}

export async function completeItem(
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void,
  itemId: string,
): Promise<void> {
  await onUpdateTask(itemId, {
    status: "done",
    completedAt: new Date().toISOString(),
  });
}

export async function reopenItem(
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void,
  itemId: string,
): Promise<void> {
  await onUpdateTask(itemId, {
    status: "backlog",
    completedAt: null,
  });
}

/** No shared activity helper in repo — skipped. */
export async function addItemActivity(_itemId: string, _text: string): Promise<void> {
  /* none */
}
