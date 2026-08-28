export function ancestorCandidateIds(item: any): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of [item?.parentId, item?.featureId, item?.epicId]) {
    const id = String(value || "").trim();
    if (!id || seen.has(id) || id === String(item?.id || "")) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function visibleParentId(item: any, presentIds: Set<string>): string {
  return ancestorCandidateIds(item).find((id) => presentIds.has(id)) || "";
}

export function hierarchyRoots(items: any[]): any[] {
  const ids = new Set(items.map((item) => String(item?.id || "")).filter(Boolean));
  return items.filter((item) => !visibleParentId(item, ids));
}

export function hierarchyChildren(items: any[], parentItemId: string): any[] {
  const parent = String(parentItemId || "");
  if (!parent) return [];
  const ids = new Set(items.map((item) => String(item?.id || "")).filter(Boolean));
  return items.filter((item) => visibleParentId(item, ids) === parent);
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

export function sortHierarchySiblings(items: any[]): any[] {
  return [...items].sort((left, right) => {
    const rank = kindRank(left) - kindRank(right);
    if (rank) return rank;
    const order = Number(left?.order ?? left?.rank ?? 0) - Number(right?.order ?? right?.rank ?? 0);
    if (order) return order;
    return String(left?.title || "").localeCompare(String(right?.title || ""));
  });
}
