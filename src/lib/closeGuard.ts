import { useSyncExternalStore } from "react";
import { hierarchyKind, normalizeItemId, presentItemIds, visibleParentId } from "./itemHierarchy";
import { isRemovedWorkItem } from "./itemRemoval";
import { canonicalWorkStatus, isCompletedWorkStatus } from "./workStatuses";

/** A parent cannot be marked done while any descendant is still open. */

export type CloseGuardChild = {
  id: string;
  title: string;
  kind: string;
};

export type CloseGuardState = {
  parentId: string;
  parentTitle: string;
  parentKind: string;
  open: CloseGuardChild[];
};

type Listener = () => void;
const listeners = new Set<Listener>();
let current: CloseGuardState | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeCloseGuard(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCloseGuardSnapshot() {
  return current;
}

export function useCloseGuard() {
  return useSyncExternalStore(subscribeCloseGuard, getCloseGuardSnapshot, () => null);
}

export function dismissCloseGuard() {
  if (!current) return;
  current = null;
  emit();
}

function itemTitle(item: unknown) {
  const record = item as { title?: unknown; name?: unknown };
  const name = String(record?.title || record?.name || "").trim();
  return name || "Untitled";
}

function kindOrder(kind: string) {
  if (kind === "epic") return 0;
  if (kind === "feature") return 1;
  if (kind === "subtask") return 3;
  return 2;
}

export function isMovingToDone(item: unknown, patch: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(patch, "status")) return false;
  const next = canonicalWorkStatus({ status: String(patch.status ?? "") });
  if (next !== "done") return false;
  return canonicalWorkStatus(item as { status?: string | null; deletedAt?: unknown }) !== "done";
}

/** Open descendants, nearest kinds first. Removed rows are ignored. Done and cancelled do not block. */
export function unfinishedDescendants(parent: unknown, items: readonly unknown[]) {
  const parentId = normalizeItemId((parent as { id?: unknown })?.id);
  if (!parentId) return [];
  const live = items.filter((item) => !isRemovedWorkItem(item));
  const ids = presentItemIds(live);
  const childrenByParent = new Map<string, unknown[]>();
  for (const item of live) {
    const pid = visibleParentId(item, ids);
    if (!pid) continue;
    const bucket = childrenByParent.get(pid) || [];
    bucket.push(item);
    childrenByParent.set(pid, bucket);
  }
  const open: unknown[] = [];
  const seen = new Set<string>([parentId]);
  const walk = (id: string) => {
    for (const child of childrenByParent.get(id) || []) {
      const childId = normalizeItemId((child as { id?: unknown }).id);
      if (!childId || seen.has(childId)) continue;
      seen.add(childId);
      const status = canonicalWorkStatus(child as { status?: string | null; deletedAt?: unknown });
      if (!isCompletedWorkStatus(status)) open.push(child);
      walk(childId);
    }
  };
  walk(parentId);
  open.sort((left, right) => {
    const rank = kindOrder(hierarchyKind(left)) - kindOrder(hierarchyKind(right));
    if (rank) return rank;
    return itemTitle(left).localeCompare(itemTitle(right));
  });
  return open;
}

/** Shows the explanation and returns true when the done write must be skipped. */
export function blockDoneWithOpenChildren(parent: unknown, items: readonly unknown[]) {
  const open = unfinishedDescendants(parent, items);
  if (!open.length) return false;
  const parentRecord = parent as { id?: unknown };
  current = {
    parentId: normalizeItemId(parentRecord?.id),
    parentTitle: itemTitle(parent),
    parentKind: hierarchyKind(parent),
    open: open.map((item) => ({
      id: normalizeItemId((item as { id?: unknown }).id),
      title: itemTitle(item),
      kind: hierarchyKind(item),
    })),
  };
  emit();
  return true;
}

export function resetCloseGuardForTests() {
  current = null;
  listeners.clear();
}
