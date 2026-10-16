const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  ready: "Ready",
  todo: "To do",
  to_do: "To do",
  in_progress: "Doing",
  doing: "Doing",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
  canceled: "Cancelled",
};

const DASH_ONLY = /^[\s\-–—−]+$/u;

function statusKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function statusActivityLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw || DASH_ONLY.test(raw)) return "";
  const key = statusKey(raw);
  return STATUS_LABELS[key] || (raw.includes("_") ? raw.replace(/_/g, " ") : raw);
}

function rewriteStatusArrow(text: string) {
  const match = text.trim().match(/^(?:system\s+)?(.+?)\s*(?:→|->)\s*([a-z0-9_ -]+)\s*$/i);
  if (!match) return "";
  const toKey = statusKey(match[2]);
  if (!STATUS_LABELS[toKey]) return "";
  const from = statusActivityLabel(match[1]);
  const to = statusActivityLabel(toKey);
  if (from && to) return `${from} → ${to}`;
  if (to) return `Moved to ${to}`;
  return "";
}

export function formatStatusActivity(entry: {
  from?: unknown;
  to?: unknown;
  status?: unknown;
  text?: unknown;
  via?: unknown;
}) {
  if (entry.via === "api" && String(entry.text || "").trim()) return String(entry.text).trim();
  const rewritten = rewriteStatusArrow(String(entry.text || ""));
  if (rewritten) return rewritten;
  const loose = rewriteStatusArrow(String(entry.status || ""));
  if (loose && !entry.to && !entry.from) return loose;
  const from = statusActivityLabel(entry.from);
  const to = statusActivityLabel(entry.to || entry.status);
  if (from && to) return `${from} → ${to}`;
  if (to) return `Moved to ${to}`;
  if (from) return `Left ${from}`;
  return "Status updated";
}
