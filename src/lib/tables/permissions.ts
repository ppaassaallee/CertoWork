import type { Column, TableDoc, TablePermissions } from "./types";

export function canEditTable(table: TableDoc, userId: string, isAdmin = false): boolean {
  if (isAdmin) return true;
  if (table.createdBy === userId) return true;
  const perms = table.permissions;
  if (!perms) return table.visibility !== "private" || table.createdBy === userId;
  if (perms.editors?.includes(userId)) return true;
  return false;
}

export function canViewTable(table: TableDoc, userId: string, isAdmin = false): boolean {
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

export function viewerHiddenColumns(table: TableDoc, userId: string): string[] {
  if (canEditTable(table, userId)) return [];
  return (table.columns || [])
    .filter(
      (c: Column) =>
        c.hidden || Boolean((c as Column & { hiddenForViewers?: boolean }).hiddenForViewers),
    )
    .map((c: Column) => c.id);
}
