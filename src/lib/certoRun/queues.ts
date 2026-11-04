import type { DeskItem, Viewer } from "./types";
import { countsOpen, inWorkspace, isOpen, mine, notDelegated } from "./types";

export interface QueueOptions {
  workspace: string;
  viewer?: Viewer;
}

function scoped(items: DeskItem[], options: QueueOptions, applyMine: boolean): DeskItem[] {
  return items.filter((item) => {
    if (!inWorkspace(item, options.workspace) || !countsOpen(item) || item.inQueue === false) return false;
    if (applyMine && options.viewer && !options.viewer.lead && !mine(item, options.viewer)) return false;
    return true;
  });
}

export function sortQ(a: DeskItem, b: DeskItem): number {
  const pin = (item: DeskItem) => (item.outcome?.kind === "pinned" ? -(item.outcome.ts ?? item.pinnedAt ?? 0) : 0);
  const pa = pin(a);
  const pb = pin(b);
  if (pa !== pb) return pa - pb;
  return (a.queueOrder ?? 9999) - (b.queueOrder ?? 9999);
}

function byPriorityThenDue(a: DeskItem, b: DeskItem): number {
  if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1;
  const da = a.dueDate || "9";
  const db = b.dueDate || "9";
  if (da === db) return 0;
  return da < db ? -1 : 1;
}

export function soloQ(items: DeskItem[], options: QueueOptions): DeskItem[] {
  return scoped(items, options, true)
    .filter((item) => item.decision === "make" && notDelegated(item))
    .sort(sortQ);
}

export function decQ(items: DeskItem[], options: QueueOptions): DeskItem[] {
  const base = scoped(items, options, true).filter((item) => item.decision === "decide" && notDelegated(item));
  const active = base.filter((item) => item.outcome?.kind !== "postponed").sort(byPriorityThenDue);
  const later = base
    .filter((item) => item.outcome?.kind === "postponed")
    .sort((a, b) => (a.outcome?.ts ?? a.postponedAt ?? 0) - (b.outcome?.ts ?? b.postponedAt ?? 0));
  return active.concat(later);
}

export function segQ(items: DeskItem[], options: QueueOptions): DeskItem[] {
  const rows = items.filter(
    (item) => inWorkspace(item, options.workspace) && countsOpen(item) && item.inQueue !== false && item.decision === "follow_up",
  );
  if (options.viewer && !options.viewer.lead) {
    return rows.filter((item) => item.requesterUid === options.viewer?.uid || (!item.requesterUid && mine(item, options.viewer!)));
  }
  return rows;
}

export function admQ(items: DeskItem[], options: QueueOptions): DeskItem[] {
  return scoped(items, options, true).filter((item) => item.decision === "admin_batch" && notDelegated(item));
}

export function delQ(items: DeskItem[], options: QueueOptions): DeskItem[] {
  return items.filter((item) => {
    if (!inWorkspace(item, options.workspace) || !isOpen(item) || item.needsWorldReview || item.inQueue === false) return false;
    if (item.type === "epic" || item.type === "feature") return false;
    const delegated = item.decision === "delegate" || (item.outcome?.kind === "delegated" && item.decision !== "follow_up");
    return delegated;
  });
}

export function adminOpen(items: DeskItem[], options: QueueOptions): DeskItem[] {
  return scoped(items, options, false).filter(
    (item) => item.lane === "admin" && notDelegated(item) && item.decision !== "follow_up" && item.inQueue !== false,
  );
}

export function openItems(items: DeskItem[], workspace: string): DeskItem[] {
  return items.filter((item) => inWorkspace(item, workspace) && countsOpen(item));
}

export function openCount(items: DeskItem[], workspace: string): number {
  return openItems(items, workspace).length;
}

export interface QueueCounts {
  make: number;
  decide: number;
  owed: number;
  admin: number;
  delegated: number;
  open: number;
}

export function queueCounts(items: DeskItem[], options: QueueOptions): QueueCounts {
  return {
    make: soloQ(items, options).length,
    decide: decQ(items, options).length,
    owed: segQ(items, options).length,
    admin: admQ(items, options).length,
    delegated: delQ(items, options).length,
    open: openCount(items, options.workspace),
  };
}

export const DEFAULT_CAPS = {
  make: 5,
  p1: 10,
  admin: 15,
  adminSlaHours: 72,
  tomorrow: 3,
  lateNights: 2,
} as const;

export type Caps = {
  make: number;
  p1: number;
  admin: number;
  adminSlaHours: number;
  tomorrow: number;
  lateNights: number;
};

export function makeInProgress(items: DeskItem[], options: QueueOptions, caps: Caps = DEFAULT_CAPS): DeskItem[] {
  return soloQ(items, options).slice(0, caps.make);
}

export function p1Alive(items: DeskItem[], options: QueueOptions): DeskItem[] {
  return openItems(items, options.workspace).filter((item) => item.priority === "P1");
}
