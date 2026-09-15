/**
 * Day plan — the personal "today" contract.
 * One document per user per date. ID = `${userId}_${date}`.
 */

export const DAY_PLANS_COLLECTION = "day_plans";

export type EnergyTag = "energizing" | "draining";

export type DayFeel = "strong" | "normal" | "weak";

export type DayPlan = {
  id: string;                 // `${userId}_${date}`
  userId: string;
  workspaceId: string;
  date: string;               // YYYY-MM-DD in the user's local time
  keyItemId: string | null;   // la tarea clave del día
  plannedItemIds: string[];   // ítems que el usuario planeó hacer hoy
  clearedItemIds: string[];   // ítems que sacó del día sin completarlos (mover / descartar)
  energy: Record<string, EnergyTag>; // itemId -> tag, se llena al cerrar el día
  feel: DayFeel | null;       // se llena al cerrar el día
  carryForward: string | null; // "qué llevás a mañana", texto libre
  closedAt: string | null;    // ISO cuando se cerró el día
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
};

export type FocusScoreInput = {
  plan: DayPlan | null;
  /** Estado actual de los ítems planeados, por id. */
  itemStatusById: Record<string, "open" | "done" | "archived">;
};

export type FocusScore = {
  value: number;              // 0..100
  keySet: boolean;
  keyDone: boolean;
  planned: number;
  done: number;
  cleared: number;
  remaining: number;          // planned - done - cleared
};

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayPlanId(userId: string, date: string): string {
  return `${userId}_${date}`;
}
