type NamedView = {
  id: string;
  name: string;
  scope?: string;
  isDefault?: boolean;
  updatedAt?: string;
};

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

function isStoredPersonal(view: NamedView) {
  if (view.isDefault) return false;
  if (view.id.startsWith("default:") || view.id.startsWith("system:")) return false;
  return view.scope !== "team";
}

function newestFirst<T extends NamedView>(views: T[]) {
  return [...views].sort(
    (left, right) =>
      String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")) ||
      right.id.localeCompare(left.id),
  );
}

/** Personal view already named `base`, so a customization updates it instead of adding another tab. */
export function personalViewToReuse<T extends NamedView>(views: T[], base: string): T | null {
  const root = nameKey(base);
  if (!root) return null;
  const matches = views.filter((view) => isStoredPersonal(view) && nameKey(view.name) === root);
  return newestFirst(matches)[0] || null;
}

/**
 * One tab per name. Keeps the active copy when the user is on a duplicate,
 * otherwise the most recently updated copy. Does not rename stored views.
 */
export function dedupeViewsForDisplay<T extends NamedView>(views: T[], activeId?: string): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const view of views) {
    const key = nameKey(view.name) || view.id;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)?.push(view);
  }
  return order.map((key) => {
    const copies = groups.get(key) || [];
    if (copies.length < 2) return copies[0];
    const active = copies.find((view) => view.id === activeId);
    if (active) return active;
    return newestFirst(copies)[0];
  });
}

/** "My view", then "My view 2", matching nextPersonalViewName without a Firestore write. */
function nextDisplayName(existingNames: string[], base: string) {
  const used = new Set(existingNames.map((name) => nameKey(name)).filter(Boolean));
  const root = base.trim() || "My view";
  if (!used.has(nameKey(root))) return root;
  let index = 2;
  while (used.has(nameKey(`${root} ${index}`))) index += 1;
  return `${root} ${index}`;
}

export function copyOnWritePlan<T extends NamedView>(
  views: T[],
  base: string,
): { action: "update"; id: string } | { action: "create"; name: string } {
  const reuse = personalViewToReuse(views, base);
  if (reuse) return { action: "update", id: reuse.id };
  return { action: "create", name: nextDisplayName(views.map((view) => view.name), base) };
}
