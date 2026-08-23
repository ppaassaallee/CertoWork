import { ODISEUS_NAME } from "./odiseus";

/** Structured agent activity fields — summary alone is not enough for dense UI. */
export type AgentActivityResult =
  | "completed"
  | "rejected"
  | "proposed"
  | "failed"
  | "info";

export type AgentActivityItem = {
  id?: string;
  action?: string;
  summary?: string;
  agentId?: string | null;
  agentName?: string | null;
  actionCount?: number | null;
  result?: AgentActivityResult | string | null;
  createdAt?: unknown;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function agentDisplayName(agentId?: string | null, agentName?: string | null) {
  if (agentName && String(agentName).trim()) return String(agentName).trim();
  if (agentId === "odysseus" || agentId === "odiseus") return ODISEUS_NAME;
  return agentName || ODISEUS_NAME;
}

export function activityResultTone(
  result?: string | null,
): "green" | "amber" | "red" | "gray" {
  const value = String(result || "").toLowerCase();
  if (value === "rejected" || value === "failed") return "red";
  if (value === "proposed" || value === "pending") return "amber";
  if (value === "completed") return "green";
  return "gray";
}

function asMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof (value as { seconds?: number }).seconds === "number") {
    return (value as { seconds: number }).seconds * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatRelativeTime(value: unknown, now = Date.now()): string {
  const ms = asMillis(value);
  if (!ms) return "";
  const delta = Math.max(0, now - ms);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

/** Verb + actor + result line for Agents activity. */
export function formatAgentActivityLine(
  item: AgentActivityItem,
  opts: { viewerUserId?: string | null } = {},
): string {
  const agent = agentDisplayName(item.agentId, item.agentName);
  const count = Number(item.actionCount || 0);
  const result = String(item.result || "").toLowerCase();
  const you =
    opts.viewerUserId && item.userId && opts.viewerUserId === item.userId;

  if (result === "rejected" || item.action === "actions_rejected") {
    const n = count > 0 ? count : 0;
    const actions =
      n > 0 ? `${n} action${n === 1 ? "" : "s"}` : "proposed actions";
    return you
      ? `You rejected ${actions} proposed by ${agent}`
      : `Rejected ${actions} proposed by ${agent}`;
  }

  if (result === "completed" || item.action === "job_completed") {
    return `${agent} completed a run`;
  }

  if (result === "proposed" || item.action === "actions_proposed") {
    const n = count > 0 ? count : 0;
    return n > 0
      ? `${agent} proposed ${n} action${n === 1 ? "" : "s"}`
      : `${agent} proposed actions`;
  }

  const summary = String(item.summary || "").trim();
  if (summary) {
    return summary.replace(/\bOdiseus\b/g, ODISEUS_NAME);
  }
  return `${agent} activity`;
}

export function countAgentRunsToday(
  items: AgentActivityItem[],
  agentId = "odysseus",
  now = Date.now(),
): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  return items.filter((item) => {
    const id = String(item.agentId || "odysseus");
    if (id !== agentId && !(agentId === "odysseus" && id === "odiseus")) {
      return false;
    }
    const action = String(item.action || "");
    const result = String(item.result || "");
    const isRun =
      action === "job_completed" ||
      result === "completed" ||
      action === "run_completed";
    if (!isRun) return false;
    return asMillis(item.createdAt) >= startMs;
  }).length;
}
