import type {
  Column,
  ColumnAccess,
  ColumnAccessException,
  ColumnAccessLevel,
  RecordDoc,
  RecordValue,
  TableDoc,
  TablePermissions,
} from "./types";

export type ColumnAccessActor = {
  userId: string;
  /** Workspace role labels (e.g. owner, admin, member, HR). */
  roles?: string[];
  /** Optional group labels the actor belongs to. */
  groups?: string[];
  isAdmin?: boolean;
};

export function canEditTable(
  table: TableDoc,
  userId: string,
  isAdmin = false,
): boolean {
  if (isAdmin) return true;
  if (table.createdBy === userId) return true;
  const perms = table.permissions;
  if (!perms) return table.visibility !== "private" || table.createdBy === userId;
  if (perms.editors?.includes(userId)) return true;
  return false;
}

export function canViewTable(
  table: TableDoc,
  userId: string,
  isAdmin = false,
): boolean {
  if (canEditTable(table, userId, isAdmin)) return true;
  const perms =
    table.permissions ||
    ({
      visibility: table.visibility || "workspace",
      editors: [],
      viewers: [],
    } satisfies TablePermissions);
  if (perms.visibility === "workspace") return true;
  if (perms.visibility === "private") return table.createdBy === userId;
  if (perms.visibility === "members") {
    return perms.editors.includes(userId) || perms.viewers.includes(userId);
  }
  return perms.viewers.includes(userId);
}

export function normalizeColumnAccess(column: Column): ColumnAccess {
  if (column.access?.defaultAccess) {
    return {
      defaultAccess: column.access.defaultAccess,
      exceptions: Array.isArray(column.access.exceptions)
        ? column.access.exceptions
        : [],
    };
  }
  if (column.hiddenForViewers) {
    return { defaultAccess: "none", exceptions: [] };
  }
  return { defaultAccess: "full", exceptions: [] };
}

export function emptyColumnAccess(): ColumnAccess {
  return { defaultAccess: "full", exceptions: [] };
}

function matchException(
  exception: ColumnAccessException,
  actor: ColumnAccessActor,
): boolean {
  const id = String(exception.subjectId || "").trim().toLowerCase();
  if (!id) return false;
  if (exception.subjectType === "user") {
    return String(actor.userId || "").toLowerCase() === id;
  }
  if (exception.subjectType === "role") {
    return (actor.roles || []).some((role) => String(role).toLowerCase() === id);
  }
  if (exception.subjectType === "group") {
    return (actor.groups || []).some(
      (group) => String(group).toLowerCase() === id,
    );
  }
  return false;
}

/**
 * Resolve effective access for one column.
 * Table editors / creator / admins always get full access.
 */
export function resolveColumnAccess(
  table: TableDoc,
  column: Column,
  actor: ColumnAccessActor,
): ColumnAccessLevel {
  if (
    canEditTable(table, actor.userId, Boolean(actor.isAdmin)) ||
    actor.isAdmin
  ) {
    return "full";
  }
  const access = normalizeColumnAccess(column);
  const hit = access.exceptions.find((exception) =>
    matchException(exception, actor),
  );
  if (hit) return hit.access;
  return access.defaultAccess;
}

export function canViewColumn(
  table: TableDoc,
  column: Column,
  actor: ColumnAccessActor,
): boolean {
  return resolveColumnAccess(table, column, actor) !== "none";
}

export function canEditColumn(
  table: TableDoc,
  column: Column,
  actor: ColumnAccessActor,
): boolean {
  return resolveColumnAccess(table, column, actor) === "full";
}

/** @deprecated Prefer visibleColumnsForActor — kept for older call sites. */
export function viewerHiddenColumns(table: TableDoc, userId: string): string[] {
  return (table.columns || [])
    .filter((column) => {
      if (column.hidden) return true;
      return !canViewColumn(table, column, { userId });
    })
    .map((column) => column.id);
}

export function visibleColumnsForActor(
  table: TableDoc,
  actor: ColumnAccessActor,
): Column[] {
  return (table.columns || []).filter(
    (column) => !column.hidden && canViewColumn(table, column, actor),
  );
}

export function redactRecordValues(
  table: TableDoc,
  record: RecordDoc,
  actor: ColumnAccessActor,
): RecordDoc {
  const next: Record<string, RecordValue> = { ...(record.values || {}) };
  for (const column of table.columns || []) {
    if (!canViewColumn(table, column, actor)) {
      delete next[column.id];
    }
  }
  return { ...record, values: next };
}

export function redactRecordsForActor(
  table: TableDoc,
  records: RecordDoc[],
  actor: ColumnAccessActor,
): RecordDoc[] {
  if (canEditTable(table, actor.userId, Boolean(actor.isAdmin))) return records;
  return records.map((record) => redactRecordValues(table, record, actor));
}

export function assertCanWriteColumn(
  table: TableDoc,
  columnId: string,
  actor: ColumnAccessActor,
): void {
  const column = (table.columns || []).find((entry) => entry.id === columnId);
  if (!column) throw new Error("Unknown column");
  if (!canEditColumn(table, column, actor)) {
    throw new Error("You do not have permission to edit this property");
  }
}

export function columnAccessLabel(level: ColumnAccessLevel): string {
  if (level === "full") return "Full access";
  if (level === "view") return "Can view property & values";
  return "No access";
}
