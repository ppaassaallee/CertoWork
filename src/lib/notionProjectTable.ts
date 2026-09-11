/** Helpers for the Notion-style project work table. */

export type NotionStatusTone = "done" | "doing" | "blocked" | "pending";

export function notionStatusLabel(status: string): string {
  const value = String(status || "").toLowerCase();
  if (["done", "completed", "closed", "cancelled", "archived"].includes(value)) return "Completado";
  if (value === "blocked") return "Bloqueado";
  if (["in_progress", "in_review", "doing", "active"].includes(value)) return "En curso";
  return "Pendiente";
}

export function notionStatusTone(status: string): NotionStatusTone {
  const label = notionStatusLabel(status);
  if (label === "Completado") return "done";
  if (label === "Bloqueado") return "blocked";
  if (label === "En curso") return "doing";
  return "pending";
}

export function notionDifficulty(priority: string | number | null | undefined): {
  label: "Low" | "Medium" | "High";
  tone: "low" | "medium" | "high";
} {
  const value = String(priority || "").toUpperCase();
  if (["1", "P1", "HIGH", "URGENT", "CRITICAL"].includes(value)) {
    return { label: "High", tone: "high" };
  }
  if (["2", "P2", "MEDIUM"].includes(value)) {
    return { label: "Medium", tone: "medium" };
  }
  return { label: "Low", tone: "low" };
}

export function notionShortDate(value: unknown): string {
  const raw = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function notionEstimateHours(item: Record<string, unknown> | null | undefined): number {
  const raw = item?.estimateHours ?? item?.estimate ?? item?.hoursEstimate ?? item?.et;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function notionStartDate(item: Record<string, unknown> | null | undefined): string {
  return String(
    item?.startDate || item?.plannedStartDate || item?.sprintStartDate || "",
  ).slice(0, 10);
}

export function notionEndDate(item: Record<string, unknown> | null | undefined): string {
  return String(item?.dueDate || item?.targetDate || item?.endDate || item?.plannedEndDate || "").slice(
    0,
    10,
  );
}
