import { nextPersonalViewName } from "./storage";

export type StoredViewName = {
  id: string;
  name: string;
  workspaceId: string;
  surface: string;
  ownerId: string;
  createdAt?: string;
};

export type ViewRename = {
  id: string;
  workspaceId: string;
  surface: string;
  ownerId: string;
  from: string;
  to: string;
};

/**
 * Plan unique names for saved views that share a name in the same
 * workspace, surface, and owner. The oldest copy keeps its name.
 * This does not write to Firestore.
 */
export function planDuplicateViewRenames(views: StoredViewName[]): ViewRename[] {
  const scopes = new Map<string, StoredViewName[]>();
  for (const view of views) {
    const key = `${view.workspaceId}\0${view.surface}\0${view.ownerId}`;
    const list = scopes.get(key) || [];
    list.push(view);
    scopes.set(key, list);
  }
  const renames: ViewRename[] = [];
  for (const group of scopes.values()) {
    const byName = new Map<string, StoredViewName[]>();
    for (const view of group) {
      const name = view.name.trim().toLowerCase();
      if (!name) continue;
      const list = byName.get(name) || [];
      list.push(view);
      byName.set(name, list);
    }
    const used = group.map((view) => view.name);
    for (const copies of byName.values()) {
      if (copies.length < 2) continue;
      const ordered = [...copies].sort(
        (left, right) =>
          String(left.createdAt || "").localeCompare(String(right.createdAt || "")) ||
          left.id.localeCompare(right.id),
      );
      for (const copy of ordered.slice(1)) {
        const to = nextPersonalViewName(used, copy.name.trim() || "My view");
        used.push(to);
        renames.push({
          id: copy.id,
          workspaceId: copy.workspaceId,
          surface: copy.surface,
          ownerId: copy.ownerId,
          from: copy.name,
          to,
        });
      }
    }
  }
  return renames;
}
