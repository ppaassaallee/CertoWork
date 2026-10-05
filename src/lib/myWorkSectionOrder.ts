/** Stable id for the My Work group of items that have no project. */
export const NO_PROJECT_SECTION = "__no_project__";

export function sectionIdForProject(projectId: unknown) {
  const id = String(projectId || "").trim();
  return id || NO_PROJECT_SECTION;
}

export function readMyWorkSectionOrder(storage: Storage, scope: string) {
  try {
    const raw = JSON.parse(storage.getItem(myWorkSectionOrderKey(scope)) || "null");
    return Array.isArray(raw) ? raw.map((id) => String(id || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeMyWorkSectionOrder(storage: Storage, scope: string, ids: string[]) {
  storage.setItem(myWorkSectionOrderKey(scope), JSON.stringify(ids));
}

export function myWorkSectionOrderKey(scope: string) {
  return `certo-my-work-section-order:${scope || "local"}`;
}

/** Saved order first. Unordered projects follow, and No Project stays last until the user moves it. */
export function orderSections<T extends { id: string; label: string }>(sections: T[], saved: string[]) {
  const rank = new Map(saved.map((id, index) => [id, index]));
  return [...sections].sort((left, right) => {
    const leftRank = rank.has(left.id) ? rank.get(left.id)! : left.id === NO_PROJECT_SECTION ? 10_000 : 5_000;
    const rightRank = rank.has(right.id) ? rank.get(right.id)! : right.id === NO_PROJECT_SECTION ? 10_000 : 5_000;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.label.localeCompare(right.label);
  });
}

export function reorderIds(current: string[], draggedId: string, targetId: string) {
  const next = current.filter((id, index) => id && current.indexOf(id) === index);
  const from = next.indexOf(draggedId);
  const to = next.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Place `draggedId` before `targetId` in a project. A missing target appends it. */
export function placeItemBefore(ids: string[], draggedId: string, targetId: string | null) {
  const next = ids.filter((id) => id && id !== draggedId);
  if (!targetId) {
    next.push(draggedId);
    return next;
  }
  const index = next.indexOf(targetId);
  if (index < 0) next.push(draggedId);
  else next.splice(index, 0, draggedId);
  return next;
}

/** Manual My Work order. Drag position wins over item type. */
export function compareManualOrder(left: { order?: unknown; rank?: unknown; title?: unknown }, right: { order?: unknown; rank?: unknown; title?: unknown }) {
  const order = Number(left?.order ?? left?.rank ?? 0) - Number(right?.order ?? right?.rank ?? 0);
  if (order) return order;
  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

export function subtreeIds(rootId: string, childIds: (id: string) => string[]) {
  const ids: string[] = [];
  const walk = (id: string) => {
    if (!id || ids.includes(id)) return;
    ids.push(id);
    for (const child of childIds(id)) walk(child);
  };
  walk(rootId);
  return ids;
}
