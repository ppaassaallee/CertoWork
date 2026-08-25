export type CollabDeskKind = "project" | "channel";

export type CollabDeskItem = {
  id: string;
  name: string;
  kind: CollabDeskKind;
  url?: string;
  projectId?: string;
  lastActivityAt?: number;
};

export function conversationActivityMs(conversation: Record<string, unknown> | null | undefined) {
  const value =
    conversation?.last_activity_at ??
    conversation?.timestamp ??
    conversation?.created_at ??
    conversation?.updated_at;
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function collabItemMatches(item: CollabDeskItem, query: string) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  return [item.name, item.projectId, item.id].some((value) =>
    String(value || "").toLowerCase().includes(needle),
  );
}

export function sortCollabItemsByRecent(items: CollabDeskItem[] = []) {
  return [...items].sort((left, right) => {
    const delta = (right.lastActivityAt || 0) - (left.lastActivityAt || 0);
    if (delta) return delta;
    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

export function partitionCollabDesk(items: CollabDeskItem[] = [], query = "") {
  const sorted = sortCollabItemsByRecent(items);
  const needle = String(query || "").trim();
  return {
    projectRooms: sorted.filter(
      (item) => item.kind === "project" && collabItemMatches(item, needle),
    ),
    otherChannels: sorted.filter(
      (item) => item.kind === "channel" && (!needle || collabItemMatches(item, needle)),
    ),
  };
}
