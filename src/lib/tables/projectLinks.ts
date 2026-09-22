import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { TABLES, type Column, type TableDoc } from "./types";

export type ProjectTableRole = "home" | "related";

export type ProjectTableRef = {
  table: TableDoc;
  role: ProjectTableRole;
};

function nowIso() {
  return new Date().toISOString();
}

export function relatedProjectIdsOf(table: Pick<TableDoc, "relatedProjectIds"> | null | undefined) {
  return Array.from(
    new Set(
      (table?.relatedProjectIds || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  );
}

/** True when this project is home or related for the table. */
export function tableTouchesProject(
  table: Pick<TableDoc, "projectId" | "relatedProjectIds">,
  projectId: string,
): boolean {
  const id = String(projectId || "").trim();
  if (!id) return false;
  if (String(table.projectId || "") === id) return true;
  return relatedProjectIdsOf(table).includes(id);
}

export function listProjectTables(
  tables: TableDoc[],
  projectId: string,
): ProjectTableRef[] {
  const id = String(projectId || "").trim();
  if (!id) return [];
  const rows: ProjectTableRef[] = [];
  for (const table of tables) {
    const isHome = String(table.projectId || "") === id;
    const isRelated = relatedProjectIdsOf(table).includes(id);
    if (!isHome && !isRelated) continue;
    rows.push({ table, role: isHome ? "home" : "related" });
  }
  return rows.sort((a, b) => {
    if (a.role !== b.role) return a.role === "home" ? -1 : 1;
    return String(a.table.name || "").localeCompare(String(b.table.name || ""));
  });
}

/** Set or clear the home project. Optionally add previous home to related. */
export async function setTableHomeProject(input: {
  tableId: string;
  projectId: string | null;
  keepPreviousAsRelated?: boolean;
  previousProjectId?: string | null;
}): Promise<void> {
  const ref = doc(db, TABLES, input.tableId);
  const patch: Record<string, unknown> = {
    projectId: input.projectId,
    updatedAt: nowIso(),
  };
  // Home must not also sit in related — remove first so a later union is clean.
  if (input.projectId) {
    await updateDoc(ref, {
      relatedProjectIds: arrayRemove(input.projectId),
      updatedAt: nowIso(),
    });
  }
  if (
    input.keepPreviousAsRelated &&
    input.previousProjectId &&
    input.previousProjectId !== input.projectId
  ) {
    patch.relatedProjectIds = arrayUnion(input.previousProjectId);
  }
  await updateDoc(ref, patch);
}

/** True when a column is a project relation (table-level or per-row links). */
export function isProjectRelationColumn(
  column: Pick<Column, "type" | "relation"> | null | undefined,
): boolean {
  if (!column) return false;
  if (column.type !== "relation" && column.type !== "link") return false;
  return column.relation?.to === "project";
}

export async function linkTableToProject(input: {
  tableId: string;
  projectId: string;
  asHome?: boolean;
  previousHomeId?: string | null;
}): Promise<void> {
  const projectId = String(input.projectId || "").trim();
  if (!projectId) return;
  if (input.asHome) {
    await setTableHomeProject({
      tableId: input.tableId,
      projectId,
      keepPreviousAsRelated: true,
      previousProjectId: input.previousHomeId,
    });
    return;
  }
  await updateDoc(doc(db, TABLES, input.tableId), {
    relatedProjectIds: arrayUnion(projectId),
    updatedAt: nowIso(),
  });
}

export async function unlinkTableFromProject(input: {
  tableId: string;
  projectId: string;
  clearHomeIfMatches?: boolean;
  currentHomeId?: string | null;
}): Promise<void> {
  const projectId = String(input.projectId || "").trim();
  if (!projectId) return;
  const patch: Record<string, unknown> = {
    relatedProjectIds: arrayRemove(projectId),
    updatedAt: nowIso(),
  };
  if (
    input.clearHomeIfMatches !== false &&
    String(input.currentHomeId || "") === projectId
  ) {
    patch.projectId = null;
  }
  await updateDoc(doc(db, TABLES, input.tableId), patch);
}

export function projectIdsFromRelationValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.map((v) => String(v || "").trim()).filter(Boolean)),
    );
  }
  const single = String(value || "").trim();
  return single ? [single] : [];
}
