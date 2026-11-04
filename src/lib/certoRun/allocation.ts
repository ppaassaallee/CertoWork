import { mondayOf, workingDaysOfMonth } from "./dates";

export const WEEKS_PER_MONTH = 4.33;
export const DEFAULT_CAP_MONTH = 170;

export interface AllocRow {
  person: string;
  project: string;
  pct: number;
}

export interface AllocationRefusal {
  ok: false;
  person: string;
  load: number;
  rows: AllocRow[];
}

export interface AllocationOk {
  ok: true;
  load: number;
}

export function hSem(capMonth: number, pct: number): number {
  return (pct / 100) * (capMonth / WEEKS_PER_MONTH);
}

export function loadOf(rows: AllocRow[], person: string): number {
  return rows.filter((row) => row.person === person).reduce((total, row) => total + (Number(row.pct) || 0), 0);
}

export function fteOf(rows: AllocRow[]): number {
  return rows.reduce((total, row) => total + (Number(row.pct) || 0), 0) / 100;
}

export function hoursWeek(rows: AllocRow[], capFor: (person: string) => number): number {
  return rows.reduce((total, row) => total + hSem(capFor(row.person), Number(row.pct) || 0), 0);
}

export function availableFte(rows: AllocRow[]): number {
  const people = [...new Set(rows.map((row) => row.person))];
  return people.reduce((total, person) => total + Math.max(0, 100 - loadOf(rows, person)), 0) / 100;
}

export function overAllocated(rows: AllocRow[]): string[] {
  return [...new Set(rows.map((row) => row.person))].filter((person) => loadOf(rows, person) > 100);
}

export function checkAllocation(rows: AllocRow[], person?: string): AllocationOk | AllocationRefusal {
  const people = person ? [person] : [...new Set(rows.map((row) => row.person))];
  for (const name of people) {
    const load = loadOf(rows, name);
    if (load > 100 + 1e-9) {
      return { ok: false, person: name, load, rows: rows.filter((row) => row.person === name) };
    }
  }
  return { ok: true, load: person ? loadOf(rows, person) : 0 };
}

export function monthHours(input: {
  person: string;
  year: number;
  month: number;
  capMonth: number;
  loadOnWeek: (week: string) => number;
}): { hours: number; cap: number; workingDays: number } {
  const days = workingDaysOfMonth(input.year, input.month);
  if (days.length === 0) return { hours: 0, cap: input.capMonth, workingDays: 0 };
  const perDay = input.capMonth / days.length;
  let hours = 0;
  for (const day of days) {
    hours += (input.loadOnWeek(mondayOf(day)) / 100) * perDay;
  }
  return { hours, cap: input.capMonth, workingDays: days.length };
}

export function utilClass(pct: number): "bad" | "ok" | "mid" | "zero" {
  if (pct > 100) return "bad";
  if (pct >= 85) return "ok";
  if (pct > 0) return "mid";
  return "zero";
}
