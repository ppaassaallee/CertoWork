export type WorkItemSearchInput = {
  id: string;
  title: string;
  key?: string;
  description?: string;
  client?: string;
  tags?: string[];
};

const RECENT_KEY = "certo-recent-items";

export function workItemKeywords(item: WorkItemSearchInput) {
  return [item.title, item.id, item.key, item.description, item.client, ...(item.tags || [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

export function readRecentItemIds(storage: Pick<Storage, "getItem"> | null = safeStorage()) {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(RECENT_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 8);
  } catch {
    return [];
  }
}

export function rememberRecentItem(
  id: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null = safeStorage(),
) {
  const clean = String(id || "").trim();
  if (!clean || !storage) return [];
  const next = [clean, ...readRecentItemIds(storage).filter((item) => item !== clean)].slice(0, 8);
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function orderPaletteItems<T extends { group: string; recentOnly?: boolean }>(
  items: T[],
  needle: string,
) {
  const visible = needle.trim() ? items.filter((item) => !item.recentOnly) : items;
  if (needle.trim()) return visible;
  const rank = (group: string) => {
    if (group === "Navigate" || group === "Actions" || group === "Create") return 0;
    if (group === "Recent") return 1;
    return 2;
  };
  return visible
    .map((item, index) => ({ item, index }))
    .sort((left, right) => rank(left.item.group) - rank(right.item.group) || left.index - right.index)
    .map((entry) => entry.item);
}

function safeStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
