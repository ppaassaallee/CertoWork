export type ItemCompare = (left: any, right: any) => number;

export function normalizeItemId(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    const record = value as { id?: unknown };
    if (record.id != null && record.id !== "") return String(record.id).trim();
  }
  const text = String(value).trim();
  return !text || text === "undefined" || text === "null" ? "" : text;
}

export function ancestorCandidateIds(item: any): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  const selfId = normalizeItemId(item?.id);
  for (const value of [item?.parentId, item?.featureId, item?.epicId]) {
    const id = normalizeItemId(value);
    if (!id || seen.has(id) || id === selfId) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function visibleParentId(item: any, presentIds: Set<string>): string {
  return ancestorCandidateIds(item).find((id) => presentIds.has(id)) || "";
}

export function presentItemIds(items: any[]): Set<string> {
  return new Set(items.map((item) => normalizeItemId(item?.id)).filter(Boolean));
}

export function hierarchyRoots(items: any[]): any[] {
  const ids = presentItemIds(items);
  return items.filter((item) => !visibleParentId(item, ids));
}

export function hierarchyChildren(items: any[], parentItemId: string): any[] {
  const parent = normalizeItemId(parentItemId);
  if (!parent) return [];
  const ids = presentItemIds(items);
  return items.filter((item) => visibleParentId(item, ids) === parent);
}

export function hierarchyRoot(item: any, items: any[]): any {
  const ids = presentItemIds(items);
  const byId = new Map(items.map((candidate) => [normalizeItemId(candidate?.id), candidate]));
  let current = item;
  const seen = new Set<string>();
  while (current) {
    const id = normalizeItemId(current?.id);
    if (!id || seen.has(id)) break;
    seen.add(id);
    const parentId = visibleParentId(current, ids);
    if (!parentId) break;
    const parent = byId.get(parentId);
    if (!parent) break;
    current = parent;
  }
  return current || item;
}

function kindRank(item: any): number {
  const value = String(
    item?.workItemType || item?.taskType || item?.issueType || item?.kind || item?.itemType || "",
  ).toLowerCase();
  if (value.includes("epic")) return 0;
  if (value.includes("feature")) return 1;
  if (value.includes("subtask") || value.includes("sub_task")) return 3;
  return 2;
}

export function compareHierarchySiblings(left: any, right: any): number {
  const rank = kindRank(left) - kindRank(right);
  if (rank) return rank;
  const order = Number(left?.order ?? left?.rank ?? 0) - Number(right?.order ?? right?.rank ?? 0);
  if (order) return order;
  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

export function sortHierarchySiblings(items: any[], compare: ItemCompare = compareHierarchySiblings): any[] {
  return [...items].sort(compare);
}

/** Flatten a forest so each parent keeps its descendants immediately after it. */
export function sortHierarchyForest(items: any[], compare: ItemCompare = compareHierarchySiblings): any[] {
  const list = [...items];
  const ids = presentItemIds(list);
  const childrenByParent = new Map<string, any[]>();
  const roots: any[] = [];
  for (const item of list) {
    const parentId = visibleParentId(item, ids);
    if (!parentId) {
      roots.push(item);
      continue;
    }
    const siblings = childrenByParent.get(parentId) || [];
    siblings.push(item);
    childrenByParent.set(parentId, siblings);
  }

  const ordered: any[] = [];
  const seen = new Set<string>();
  const walk = (node: any) => {
    const id = normalizeItemId(node?.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(node);
    const children = sortHierarchySiblings(childrenByParent.get(id) || [], compare);
    children.forEach(walk);
  };

  sortHierarchySiblings(roots, compare).forEach(walk);
  for (const item of list) {
    const id = normalizeItemId(item?.id);
    if (id && !seen.has(id)) walk(item);
  }
  return ordered;
}
