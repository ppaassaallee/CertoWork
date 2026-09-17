import type {
  ApplyContext,
  ApplyGroup,
  ApplyResult,
  ColumnDef,
  EntityAdapter,
  FilterRule,
  SavedView,
} from "./types";
import type { RecordValue } from "../tables/types";
import { isTodayTask } from "../appleWidget";
import { isThisWeekTask } from "../myWorkItems";

function todayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function asString(value: RecordValue): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(String).join(",");
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function asDateKey(value: RecordValue): string | null {
  if (value == null || value === "") return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return todayKey(new Date(parsed));
}

function columnById<Row>(adapter: EntityAdapter<Row>, id: string): ColumnDef<Row> | undefined {
  return adapter.columns.find((col) => col.id === id);
}

function isDoneValue(value: RecordValue): boolean {
  const raw = asString(value).toLowerCase();
  return ["done", "completed", "closed", "cancelled"].includes(raw);
}

function meTokens(ctx: ApplyContext): Set<string> {
  const tokens = new Set<string>();
  if (ctx.userId) tokens.add(String(ctx.userId));
  for (const id of ctx.memberIds || []) {
    if (id) tokens.add(String(id));
  }
  return tokens;
}

function valueMatchesMe(value: RecordValue, ctx: ApplyContext): boolean {
  const tokens = meTokens(ctx);
  if (!tokens.size) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => tokens.has(String(entry)));
  }
  const text = asString(value);
  if (!text) return false;
  // Person columns may join ids with commas via asString — also check raw text.
  if (tokens.has(text)) return true;
  return text.split(",").some((part) => tokens.has(part.trim()));
}

function matchesFilter<Row>(
  row: Row,
  rule: FilterRule,
  adapter: EntityAdapter<Row>,
  ctx: ApplyContext,
  now: Date,
): boolean {
  const column = columnById(adapter, rule.columnId);
  if (!column) return true;
  const value = column.read(row);
  const text = asString(value);
  const dateKey = asDateKey(value);

  switch (rule.op) {
    case "eq":
      return text === String(rule.value ?? "");
    case "ne":
      return text !== String(rule.value ?? "");
    case "in": {
      const list = Array.isArray(rule.value) ? rule.value.map(String) : [String(rule.value ?? "")];
      if (Array.isArray(value)) return value.some((entry) => list.includes(String(entry)));
      return list.includes(text);
    }
    case "contains":
      return text.toLowerCase().includes(String(rule.value ?? "").toLowerCase());
    case "empty":
      return text === "" || value == null || (Array.isArray(value) && value.length === 0);
    case "notEmpty":
      return !(text === "" || value == null || (Array.isArray(value) && value.length === 0));
    case "before":
      return Boolean(dateKey && dateKey < String(rule.value ?? ""));
    case "after":
      return Boolean(dateKey && dateKey > String(rule.value ?? ""));
    case "me":
      return valueMatchesMe(value, ctx);
    case "overdue": {
      if (!dateKey || dateKey >= todayKey(now)) return false;
      const statusCol =
        columnById(adapter, "status") ||
        adapter.columns.find((col) => col.type === "status");
      if (statusCol && isDoneValue(statusCol.read(row))) return false;
      return true;
    }
    case "today": {
      if (dateKey === todayKey(now)) return true;
      // Align with My Work: One Thing / timeSector today without dueDate.
      if (row && typeof row === "object") {
        return isTodayTask(row, todayKey(now));
      }
      return false;
    }
    case "week": {
      if (dateKey) {
        const start = todayKey(now);
        const end = weekEndKey(now);
        if (dateKey >= start && dateKey <= end) return true;
      }
      if (row && typeof row === "object") {
        return isThisWeekTask(row as Record<string, unknown>, now);
      }
      return false;
    }
    default:
      return true;
  }
}

function weekEndKey(now: Date): string {
  const day = now.getDay(); // 0 Sun … 6 Sat
  const daysUntilSat = (6 - day + 7) % 7;
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + daysUntilSat);
  return todayKey(end);
}

function compareValues(left: RecordValue, right: RecordValue): number {
  const leftDate = asDateKey(left);
  const rightDate = asDateKey(right);
  if (leftDate && rightDate) return leftDate.localeCompare(rightDate);
  const leftNum = typeof left === "number" ? left : Number(left);
  const rightNum = typeof right === "number" ? right : Number(right);
  if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && left !== "" && right !== "") {
    return leftNum - rightNum;
  }
  return asString(left).localeCompare(asString(right), undefined, { sensitivity: "base" });
}

function sortRows<Row>(
  rows: Row[],
  adapter: EntityAdapter<Row>,
  view: SavedView,
): Row[] {
  if (!view.sort.length) return rows;
  return [...rows].sort((a, b) => {
    for (const rule of view.sort) {
      const column = columnById(adapter, rule.columnId);
      if (!column) continue;
      const cmp = compareValues(column.read(a), column.read(b));
      if (cmp !== 0) return rule.dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

function optionLabel<Row>(column: ColumnDef<Row> | undefined, key: string): string {
  if (!column?.options) return key;
  const match = column.options().find((opt) => opt.id === key || opt.label === key);
  return match?.label || key;
}

function groupRows<Row>(
  rows: Row[],
  adapter: EntityAdapter<Row>,
  view: SavedView,
): ApplyGroup<Row>[] {
  if (!view.groupBy) {
    return [{ key: "all", label: "", rows }];
  }
  const column = columnById(adapter, view.groupBy);
  if (!column) return [{ key: "all", label: "", rows }];

  const buckets = new Map<string, Row[]>();
  for (const row of rows) {
    const raw = column.read(row);
    const key = asString(raw) || "__none__";
    const list = buckets.get(key) || [];
    list.push(row);
    buckets.set(key, list);
  }

  const orderedKeys: string[] = [];
  if (column.options) {
    for (const opt of column.options()) {
      if (buckets.has(opt.id)) orderedKeys.push(opt.id);
    }
  }
  for (const key of buckets.keys()) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  return orderedKeys.map((key) => ({
    key,
    label: key === "__none__" ? "—" : optionLabel(column, key),
    rows: buckets.get(key) || [],
  }));
}

/**
 * Keep children under their parent when hierarchy is enabled, even if the
 * flat sort would otherwise separate them.
 */
function applyHierarchy<Row>(
  rows: Row[],
  adapter: EntityAdapter<Row>,
  showSubtasks: boolean,
): Row[] {
  if (!showSubtasks || !adapter.parentId) return rows;
  const byId = new Map(rows.map((row) => [adapter.rowId(row), row]));
  const children = new Map<string, Row[]>();
  const roots: Row[] = [];

  for (const row of rows) {
    const parent = adapter.parentId(row);
    if (parent && byId.has(parent)) {
      const list = children.get(parent) || [];
      list.push(row);
      children.set(parent, list);
    } else {
      roots.push(row);
    }
  }

  const ordered: Row[] = [];
  const walk = (row: Row) => {
    ordered.push(row);
    for (const child of children.get(adapter.rowId(row)) || []) walk(child);
  };
  for (const root of roots) walk(root);
  // Orphans already in roots; any leftover (cycle) append once.
  for (const row of rows) {
    if (!ordered.includes(row)) ordered.push(row);
  }
  return ordered;
}

export function applyView<Row>(
  rows: Row[],
  adapter: EntityAdapter<Row>,
  view: SavedView,
  ctx: ApplyContext,
): ApplyResult<Row> {
  const now = ctx.now || new Date();
  let next = rows.filter((row) =>
    view.filters.every((rule) => matchesFilter(row, rule, adapter, ctx, now)),
  );
  next = sortRows(next, adapter, view);
  next = applyHierarchy(next, adapter, Boolean(view.showSubtasks));
  const groups = groupRows(next, adapter, view).map((group) => ({
    ...group,
    rows: applyHierarchy(group.rows, adapter, Boolean(view.showSubtasks)),
  }));
  return {
    rows: groups.flatMap((group) => group.rows),
    groups,
  };
}

export function viewToQuery(view: SavedView) {
  return {
    filters: view.filters,
    sort: view.sort,
    groupBy: view.groupBy,
    layout: view.layout,
    density: view.density,
    showSubtasks: view.showSubtasks,
  };
}
