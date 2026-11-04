import { adminOpen, DEFAULT_CAPS, makeInProgress, p1Alive, soloQ, type Caps, type QueueOptions } from "./queues";
import type { DeskItem } from "./types";
import { daysBetween } from "./dates";

export interface CapRefusal {
  ok: false;
  status: 409;
  code: "make" | "p1" | "admin" | "tomorrow";
  cap: number;
  current: { id: string; title: string; externalId: string }[];
}

export interface CapOk {
  ok: true;
}

export type CapResult = CapOk | CapRefusal;

function list(items: DeskItem[]): CapRefusal["current"] {
  return items.map((item) => ({ id: item.id, title: item.title, externalId: item.externalId }));
}

export function checkMoveToMake(items: DeskItem[], options: QueueOptions, itemId: string, caps: Caps = DEFAULT_CAPS): CapResult {
  const queue = soloQ(items, options);
  if (queue.some((item) => item.id === itemId)) return { ok: true };
  if (queue.length >= caps.make) {
    return { ok: false, status: 409, code: "make", cap: caps.make, current: list(queue.slice(0, caps.make)) };
  }
  return { ok: true };
}

export function checkSetPriority(
  items: DeskItem[],
  options: QueueOptions,
  itemId: string,
  priority: string,
  caps: Caps = DEFAULT_CAPS,
): CapResult {
  if (priority !== "P1") return { ok: true };
  const item = items.find((row) => row.id === itemId);
  if (item?.priority === "P1") return { ok: true };
  const alive = p1Alive(items, options);
  if (alive.length >= caps.p1) {
    return { ok: false, status: 409, code: "p1", cap: caps.p1, current: list(alive.slice(0, caps.p1)) };
  }
  return { ok: true };
}

export function checkAdminWrite(items: DeskItem[], options: QueueOptions, itemId: string, caps: Caps = DEFAULT_CAPS): CapResult {
  const open = adminOpen(items, options);
  if (open.some((item) => item.id === itemId)) return { ok: true };
  if (open.length >= caps.admin) {
    return { ok: false, status: 409, code: "admin", cap: caps.admin, current: list(open.slice(0, caps.admin)) };
  }
  return { ok: true };
}

export function checkTop3(currentIds: string[], itemId: string, caps: Caps = DEFAULT_CAPS): CapResult {
  if (currentIds.includes(itemId)) return { ok: true };
  if (currentIds.length >= caps.tomorrow) {
    return {
      ok: false,
      status: 409,
      code: "tomorrow",
      cap: caps.tomorrow,
      current: currentIds.map((id) => ({ id, title: id, externalId: id })),
    };
  }
  return { ok: true };
}

export function adminAged(item: DeskItem, today: string, caps: Caps = DEFAULT_CAPS): boolean {
  if (!item.created) return false;
  return daysBetween(item.created, today) * 24 > caps.adminSlaHours;
}

export function agedAdminCount(items: DeskItem[], options: QueueOptions, today: string, caps: Caps = DEFAULT_CAPS): number {
  return adminOpen(items, options).filter((item) => adminAged(item, today, caps)).length;
}

export { makeInProgress };
