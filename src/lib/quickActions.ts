export const ROW_QUICK_ACTIONS = [
  "collab",
  "parent",
  "project",
  "delivery_entity",
  "client_entity",
  "tags",
  "work_category",
  "product_phase",
  "status",
  "priority",
  "gtd",
  "bucket",
  "assignees",
  "due",
  "sprint",
] as const;

export const CREATE_QUICK_ACTIONS = [
  "project",
  "type",
  "parent",
  "due",
  "assignee",
  "priority",
  "delivery",
] as const;

export type RowQuickAction = (typeof ROW_QUICK_ACTIONS)[number];
export type CreateQuickAction = (typeof CREATE_QUICK_ACTIONS)[number];

export const ROW_QUICK_ACTION_LABELS: Record<RowQuickAction, string> = {
  collab: "Collab",
  parent: "Parent",
  project: "Project",
  delivery_entity: "Delivery Entity",
  client_entity: "Client Entity",
  tags: "Tags",
  work_category: "Work Category",
  product_phase: "Product Phase",
  status: "Status",
  priority: "Priority",
  gtd: "GTD",
  bucket: "Action Board",
  assignees: "Assignee",
  due: "Due",
  sprint: "Sprint",
};

export const CREATE_QUICK_ACTION_LABELS: Record<CreateQuickAction, string> = {
  project: "Project",
  type: "Type",
  parent: "Parent",
  due: "Due",
  assignee: "Assignee",
  priority: "Priority",
  delivery: "Delivery",
};

export const MY_WORK_ROW_ACTIONS_KEY = "certo-my-work-row-actions";
export const MY_WORK_CREATE_ACTIONS_KEY = "certo-my-work-create-actions";

export function normalizeQuickActions<T extends string>(
  saved: unknown,
  all: readonly T[],
  fallback: readonly T[],
): T[] {
  if (!Array.isArray(saved)) return [...fallback];
  const allowed = new Set(all);
  const next: T[] = [];
  for (const key of saved) {
    if (typeof key !== "string" || !allowed.has(key as T) || next.includes(key as T)) continue;
    next.push(key as T);
  }
  return next;
}

export function hiddenQuickActions<T extends string>(current: readonly T[], all: readonly T[]): T[] {
  const visible = new Set(current);
  return all.filter((key) => !visible.has(key));
}

export function removeQuickAction<T extends string>(current: readonly T[], key: T): T[] {
  return current.filter((item) => item !== key);
}

export function addQuickAction<T extends string>(
  current: readonly T[],
  key: T,
  all: readonly T[],
  after?: T,
): T[] {
  if (!all.includes(key) || current.includes(key)) return [...current];
  const next = [...current];
  const index = after ? next.indexOf(after) : -1;
  if (index >= 0) next.splice(index + 1, 0, key);
  else next.push(key);
  return next;
}

export function moveQuickAction<T extends string>(current: readonly T[], key: T, direction: -1 | 1): T[] {
  const index = current.indexOf(key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= current.length) return [...current];
  const next = [...current];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function readQuickActions<T extends string>(
  storage: Pick<Storage, "getItem"> | null | undefined,
  key: string,
  all: readonly T[],
): T[] {
  if (!storage) return [...all];
  const raw = storage.getItem(key);
  if (!raw) return [...all];
  try {
    return normalizeQuickActions(JSON.parse(raw), all, all);
  } catch {
    return [...all];
  }
}

export function writeQuickActions(
  storage: Pick<Storage, "setItem"> | null | undefined,
  key: string,
  actions: readonly string[],
) {
  storage?.setItem(key, JSON.stringify(actions));
}
