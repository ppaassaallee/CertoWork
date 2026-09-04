import { AlertTriangle, Ban, Check, Circle, Square } from "./Icon";

export const STATUS_TONES = ["green", "amber", "red", "blue", "gray"] as const;
export type StatusTone = (typeof STATUS_TONES)[number];
export type ProjectHealthTone = "on_track" | "at_risk" | "blocked";

const LABELS: Record<StatusTone, string> = {
  green: "On track",
  amber: "At risk",
  red: "Blocked",
  blue: "In progress",
  gray: "Not started",
};

export function healthToStatus(health?: string | null): StatusTone {
  const value = String(health || "").toLowerCase();
  if (["blocked", "critical", "red", "overdue"].includes(value)) return "red";
  if (["at_risk", "at risk", "risk", "warning", "yellow", "amber", "pending"].includes(value)) {
    return "amber";
  }
  if (["in_progress", "active", "info", "blue"].includes(value)) return "blue";
  if (["not_started", "archived", "gray", "idle"].includes(value)) return "gray";
  return "green";
}

export function taskDueStatus(input: {
  status?: string | null;
  dueDate?: string | number | Date | null;
  now?: number;
}): StatusTone {
  const status = String(input.status || "").toLowerCase();
  if (["done", "completed", "closed", "cancelled"].includes(status)) return "green";
  const due = input.dueDate;
  if (!due) return "gray";
  const dueTime =
    due instanceof Date
      ? due.getTime()
      : typeof due === "number"
        ? due
        : /^\d{4}-\d{2}-\d{2}$/.test(String(due))
          ? (() => {
              const [year, month, day] = String(due).split("-").map(Number);
              return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
            })()
          : Date.parse(String(due));
  if (!Number.isFinite(dueTime)) return "gray";
  const now = input.now ?? Date.now();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (dueTime < startOfToday.getTime()) return "red";
  if (dueTime <= endOfToday.getTime()) return "amber";
  return "blue";
}

const SHAPE = {
  green: Check,
  amber: AlertTriangle,
  red: Square,
  blue: Circle,
  gray: Ban,
} as const;

export function StatusLight({
  status,
  label,
  size = "md",
  pulse,
}: {
  status: StatusTone;
  label?: string | boolean;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}) {
  const text =
    label === false || label === undefined
      ? label === false
        ? null
        : LABELS[status]
      : String(label);
  const Shape = SHAPE[status];
  const shouldPulse = pulse ?? status === "red";
  return (
    <span
      className={`status-light status-light--${status} status-light--${size}${shouldPulse ? " is-pulse" : ""}`}
      data-status={status}
    >
      <span className="status-light-dot" aria-hidden="true" />
      <Shape aria-hidden="true" className="status-light-shape" size={size === "lg" ? 12 : 10} />
      {text ? (
        <span className="status-light-label">{text}</span>
      ) : (
        <span className="sr-only">{LABELS[status]}</span>
      )}
    </span>
  );
}
