const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  ready: "Ready",
  todo: "To do",
  in_progress: "Doing",
  doing: "Doing",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
  canceled: "Cancelled",
};

export function statusActivityLabel(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw === "—" || raw === "-") return "";
  return STATUS_LABELS[raw.toLowerCase()] || raw.replace(/_/g, " ");
}

export function formatStatusActivity(entry: { from?: unknown; to?: unknown; status?: unknown }) {
  const from = statusActivityLabel(entry.from);
  const to = statusActivityLabel(entry.to || entry.status);
  if (from && to) return `${from} → ${to}`;
  if (to) return `Moved to ${to}`;
  if (from) return `Left ${from}`;
  return "Status updated";
}
