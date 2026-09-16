import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { emitDomainEvent } from "../routines/events";
import { coerceValue, validateRecord } from "./validate";
import { ensureStatusOptionTones } from "./statusTones";
import {
  RECORD_ACTIVITY,
  RECORD_LINK_RELATION,
  TABLE_ITEM_RELATION,
  TABLE_RECORDS,
  TABLES,
  type Column,
  type KeyColumns,
  type RecordDoc,
  type RecordLinkTarget,
  type RecordValue,
  type TableDoc,
  type TableStatus,
  type TableVisibility,
} from "./types";
import { TABLE_FORMS } from "./tableForms";

const BATCH_LIMIT = 400;
const PURGE_DAYS = 30;

function nowIso() {
  return new Date().toISOString();
}

function linkDocId(recordId: string, target: RecordLinkTarget) {
  return `${recordId}__${target.type}__${target.id}`;
}

function tableItemLinkId(tableId: string, itemId: string) {
  return `table__${tableId}__task__${itemId}`;
}

export function tableLifecycleStatus(
  table: Pick<TableDoc, "status"> | null | undefined,
): TableStatus {
  const raw = String(table?.status || "active").toLowerCase();
  if (raw === "archived" || raw === "deleted") return raw;
  return "active";
}

export function isActiveTable(table: Pick<TableDoc, "status"> | null | undefined) {
  return tableLifecycleStatus(table) === "active";
}

export function canSeeTable(
  table: Pick<TableDoc, "visibility" | "createdBy" | "projectId" | "status">,
  uid: string,
  projectIds: string[],
  opts?: { includeArchived?: boolean; includeDeleted?: boolean },
): boolean {
  const status = tableLifecycleStatus(table);
  if (status === "archived" && !opts?.includeArchived) return false;
  if (status === "deleted" && !opts?.includeDeleted) return false;
  if (table.visibility === "private") return table.createdBy === uid;
  if (table.visibility === "project") {
    return Boolean(table.projectId && projectIds.includes(String(table.projectId)));
  }
  return true;
}

export async function createTable(
  input: Omit<TableDoc, "id" | "recordCount" | "createdAt" | "updatedAt"> & {
    userId?: string;
  },
): Promise<string> {
  const now = nowIso();
  const { userId: explicitUserId, ...rest } = input;
  const columns = (rest.columns || []).map((col) =>
    col.type === "status"
      ? { ...col, options: ensureStatusOptionTones(col.options || []) }
      : col,
  );
  const ref = await addDoc(collection(db, TABLES), {
    ...rest,
    columns,
    // Keep userId in sync with createdBy so workspace listeners that filter by userId still match.
    userId: explicitUserId || rest.createdBy,
    status: rest.status || "active",
    recordCount: 0,
    itemCount: rest.itemCount ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function archiveTable(tableId: string, previousStatus?: TableStatus | string | null) {
  const now = nowIso();
  await updateDoc(doc(db, TABLES, tableId), {
    status: "archived",
    previousStatus: previousStatus || "active",
    archivedAt: now,
    deletedAt: null,
    purgeAfter: null,
    updatedAt: now,
  });
}

export async function softDeleteTable(tableId: string, previousStatus?: TableStatus | string | null) {
  const deletedAt = new Date();
  const purgeAfter = new Date(deletedAt.getTime() + PURGE_DAYS * 24 * 60 * 60 * 1000);
  await updateDoc(doc(db, TABLES, tableId), {
    status: "deleted",
    previousStatus: previousStatus || "active",
    deletedAt: deletedAt.toISOString(),
    purgeAfter: purgeAfter.toISOString(),
    archivedAt: null,
    updatedAt: nowIso(),
  });
  return { deletedAt, purgeAfter };
}

export async function restoreTable(tableId: string, previousStatus?: TableStatus | string | null) {
  const now = nowIso();
  const nextStatus =
    previousStatus === "archived" || previousStatus === "deleted" ? "active" : previousStatus || "active";
  await updateDoc(doc(db, TABLES, tableId), {
    status: nextStatus === "deleted" ? "active" : nextStatus,
    deletedAt: null,
    purgeAfter: null,
    archivedAt: null,
    restoredAt: now,
    updatedAt: now,
  });
}

async function commitInChunks(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>,
) {
  for (let index = 0; index < ops.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(index, index + BATCH_LIMIT).forEach((apply) => apply(batch));
    await batch.commit();
  }
}

/**
 * Cascade-purge a table. Child list rules require workspace membership on
 * `workspaceId`, so every query must include that field — a tableId-only
 * query fails with permission-denied even when the result set is empty.
 */
export async function permanentlyDeleteTable(
  tableId: string,
  workspaceId?: string,
): Promise<void> {
  let resolvedWorkspaceId = String(workspaceId || "").trim();
  if (!resolvedWorkspaceId) {
    const tableSnap = await getDoc(doc(db, TABLES, tableId));
    if (!tableSnap.exists()) return;
    resolvedWorkspaceId = String(tableSnap.data()?.workspaceId || "").trim();
  }
  if (!resolvedWorkspaceId) {
    throw new Error("Missing workspace for permanent table delete.");
  }

  // Prefer compound queries; fall back to a workspace scan if the composite
  // index is still building (failed-precondition).
  const recordsSnap = await queryWorkspaceChildren(
    TABLE_RECORDS,
    resolvedWorkspaceId,
    "tableId",
    tableId,
  );
  const formsSnap = await queryWorkspaceChildren(
    TABLE_FORMS,
    resolvedWorkspaceId,
    "tableId",
    tableId,
  );
  const tableLinksSnap = await getDocs(
    query(
      collection(db, "entity_links"),
      where("fromEntityType", "==", "table"),
      where("fromEntityId", "==", tableId),
    ),
  );

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const recordDoc of recordsSnap) {
    const recordId = recordDoc.id;
    const activitySnap = await queryWorkspaceChildren(
      RECORD_ACTIVITY,
      resolvedWorkspaceId,
      "recordId",
      recordId,
    );
    const linksSnap = await getDocs(
      query(
        collection(db, "entity_links"),
        where("fromEntityType", "==", "record"),
        where("fromEntityId", "==", recordId),
      ),
    );
    for (const row of activitySnap) {
      ops.push((batch) => batch.delete(row.ref));
    }
    for (const row of linksSnap.docs) {
      ops.push((batch) => batch.delete(row.ref));
    }
    ops.push((batch) => batch.delete(recordDoc.ref));
  }

  for (const row of formsSnap) {
    ops.push((batch) => batch.delete(row.ref));
  }
  for (const row of tableLinksSnap.docs) {
    ops.push((batch) => batch.delete(row.ref));
  }

  ops.push((batch) => batch.delete(doc(db, TABLES, tableId)));
  await commitInChunks(ops);
}

async function queryWorkspaceChildren(
  collectionName: string,
  workspaceId: string,
  field: string,
  value: string,
) {
  try {
    const snap = await getDocs(
      query(
        collection(db, collectionName),
        where("workspaceId", "==", workspaceId),
        where(field, "==", value),
      ),
    );
    return snap.docs;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (!/failed-precondition|requires an index/i.test(message)) throw error;
    const snap = await getDocs(
      query(collection(db, collectionName), where("workspaceId", "==", workspaceId)),
    );
    return snap.docs.filter(
      (row) => String((row.data() as Record<string, unknown>)[field] || "") === value,
    );
  }
}

export async function linkTableItem(input: {
  workspaceId: string;
  userId: string;
  tableId: string;
  itemId: string;
}): Promise<void> {
  const id = tableItemLinkId(input.tableId, input.itemId);
  const existing = await getDoc(doc(db, "entity_links", id));
  if (existing.exists()) return;

  await setDoc(doc(db, "entity_links", id), {
    workspaceId: input.workspaceId,
    userId: input.userId,
    createdBy: input.userId,
    fromEntityType: "table",
    fromEntityId: input.tableId,
    toEntityType: "task",
    toEntityId: input.itemId,
    relationType: TABLE_ITEM_RELATION,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, TABLES, input.tableId), {
    itemCount: increment(1),
    updatedAt: nowIso(),
  });
}

export async function unlinkTableItem(input: {
  tableId: string;
  itemId: string;
}): Promise<void> {
  const id = tableItemLinkId(input.tableId, input.itemId);
  const existing = await getDoc(doc(db, "entity_links", id));
  if (!existing.exists()) return;
  await deleteDoc(doc(db, "entity_links", id));
  await updateDoc(doc(db, TABLES, input.tableId), {
    itemCount: increment(-1),
    updatedAt: nowIso(),
  });
}

export async function listTableItems(tableId: string): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db, "entity_links"),
      where("fromEntityType", "==", "table"),
      where("fromEntityId", "==", tableId),
      where("relationType", "==", TABLE_ITEM_RELATION),
    ),
  );
  return snap.docs
    .map((row) => String((row.data() as { toEntityId?: string }).toEntityId || ""))
    .filter(Boolean);
}

export async function updateTableColumns(
  tableId: string,
  columns: Column[],
  keyColumns: KeyColumns,
): Promise<void> {
  const normalized = columns.map((col) =>
    col.type === "status"
      ? { ...col, options: ensureStatusOptionTones(col.options || []) }
      : col,
  );
  await updateDoc(doc(db, TABLES, tableId), {
    columns: normalized,
    keyColumns,
    updatedAt: nowIso(),
  });
}

export async function setTableVisibility(
  tableId: string,
  visibility: TableVisibility,
  projectId: string | null,
): Promise<void> {
  await updateDoc(doc(db, TABLES, tableId), {
    visibility,
    projectId,
    updatedAt: nowIso(),
  });
}

async function appendActivity(input: {
  recordId: string;
  tableId: string;
  workspaceId: string;
  actorId: string | null;
  kind: "created" | "field_changed" | "linked" | "unlinked" | "comment" | "automation";
  columnId?: string;
  from?: RecordValue;
  to?: RecordValue;
  text?: string;
  routineId?: string;
}) {
  await addDoc(collection(db, RECORD_ACTIVITY), {
    ...input,
    createdAt: nowIso(),
  });
}

export async function createRecord(input: {
  tableId: string;
  workspaceId: string;
  values: Record<string, RecordValue>;
  actorId: string;
}): Promise<string> {
  const tableSnap = await getDoc(doc(db, TABLES, input.tableId));
  if (!tableSnap.exists()) throw new Error("Table not found");
  const table = { id: tableSnap.id, ...(tableSnap.data() as Omit<TableDoc, "id">) };

  const coerced: Record<string, RecordValue> = {};
  for (const column of table.columns) {
    if (input.values[column.id] === undefined) continue;
    const next = coerceValue(column, input.values[column.id]);
    if (next !== undefined) coerced[column.id] = next;
  }

  const check = validateRecord(table, coerced);
  if (!check.ok) {
    const first = Object.values(check.errors)[0] || "Invalid record";
    throw new Error(first);
  }

  const now = nowIso();
  const order = Number(table.recordCount || 0);

  const ref = await addDoc(collection(db, TABLE_RECORDS), {
    tableId: input.tableId,
    workspaceId: input.workspaceId,
    values: coerced,
    order,
    createdBy: input.actorId,
    userId: input.actorId,
    createdAt: now,
    updatedAt: now,
    updatedBy: input.actorId,
    linkCount: 0,
  });

  await updateDoc(doc(db, TABLES, input.tableId), {
    recordCount: increment(1),
    updatedAt: now,
  });

  await appendActivity({
    recordId: ref.id,
    tableId: input.tableId,
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    kind: "created",
  });

  await emitDomainEvent({
    workspaceId: input.workspaceId,
    userId: input.actorId,
    eventType: "table.record_created",
    entityType: "record",
    entityId: ref.id,
    projectId: table.projectId ?? null,
    meta: { tableId: input.tableId, recordId: ref.id },
  });

  return ref.id;
}

export async function updateRecordField(input: {
  table: TableDoc;
  recordId: string;
  columnId: string;
  value: RecordValue;
  actorId: string;
}): Promise<void> {
  const column = input.table.columns.find((c) => c.id === input.columnId);
  if (!column) throw new Error("Unknown column");

  const coerced = coerceValue(column, input.value);
  if (coerced === undefined && input.value !== null) {
    throw new Error(`Invalid value for ${column.name}`);
  }

  const recordRef = doc(db, TABLE_RECORDS, input.recordId);
  const snap = await getDoc(recordRef);
  if (!snap.exists()) throw new Error("Record not found");
  const data = snap.data() as RecordDoc;
  const from = (data.values?.[input.columnId] ?? null) as RecordValue;
  const to = coerced === undefined ? null : coerced;
  if (JSON.stringify(from) === JSON.stringify(to)) return;

  const now = nowIso();
  await updateDoc(recordRef, {
    [`values.${input.columnId}`]: to,
    updatedAt: now,
    updatedBy: input.actorId,
  });

  await appendActivity({
    recordId: input.recordId,
    tableId: input.table.id,
    workspaceId: input.table.workspaceId,
    actorId: input.actorId,
    kind: "field_changed",
    columnId: input.columnId,
    from,
    to,
  });

  const statusCol = input.table.keyColumns.status;
  if (statusCol && input.columnId === statusCol && String(from ?? "") !== String(to ?? "")) {
    await emitDomainEvent({
      workspaceId: input.table.workspaceId,
      userId: input.actorId,
      eventType: "table.status_changed",
      entityType: "record",
      entityId: input.recordId,
      projectId: input.table.projectId ?? null,
      meta: {
        tableId: input.table.id,
        recordId: input.recordId,
        columnId: input.columnId,
        from: from == null ? null : String(from),
        to: to == null ? "" : String(to),
      },
    });
  }
}

export async function deleteRecord(
  tableId: string,
  recordId: string,
  workspaceId?: string,
): Promise<void> {
  let resolvedWorkspaceId = String(workspaceId || "").trim();
  if (!resolvedWorkspaceId) {
    const recordSnap = await getDoc(doc(db, TABLE_RECORDS, recordId));
    if (recordSnap.exists()) {
      resolvedWorkspaceId = String(recordSnap.data()?.workspaceId || "").trim();
    }
  }
  if (!resolvedWorkspaceId) {
    const tableSnap = await getDoc(doc(db, TABLES, tableId));
    resolvedWorkspaceId = String(tableSnap.data()?.workspaceId || "").trim();
  }

  const activityDocs = resolvedWorkspaceId
    ? await queryWorkspaceChildren(
        RECORD_ACTIVITY,
        resolvedWorkspaceId,
        "recordId",
        recordId,
      )
    : [];
  const linksSnap = await getDocs(
    query(
      collection(db, "entity_links"),
      where("fromEntityType", "==", "record"),
      where("fromEntityId", "==", recordId),
    ),
  );

  const batch = writeBatch(db);
  for (const row of activityDocs) batch.delete(row.ref);
  for (const row of linksSnap.docs) batch.delete(row.ref);
  batch.delete(doc(db, TABLE_RECORDS, recordId));
  batch.update(doc(db, TABLES, tableId), {
    recordCount: increment(-1),
    updatedAt: nowIso(),
  });
  await batch.commit();
}

export async function linkRecord(input: {
  workspaceId: string;
  userId: string;
  recordId: string;
  tableId: string;
  target: RecordLinkTarget;
}): Promise<void> {
  const id = linkDocId(input.recordId, input.target);
  const existing = await getDoc(doc(db, "entity_links", id));
  if (existing.exists()) return;

  await setDoc(doc(db, "entity_links", id), {
    workspaceId: input.workspaceId,
    userId: input.userId,
    createdBy: input.userId,
    fromEntityType: "record",
    fromEntityId: input.recordId,
    toEntityType: input.target.type,
    toEntityId: input.target.id,
    relationType: RECORD_LINK_RELATION,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, TABLE_RECORDS, input.recordId), {
    linkCount: increment(1),
    updatedAt: nowIso(),
  });

  await appendActivity({
    recordId: input.recordId,
    tableId: input.tableId,
    workspaceId: input.workspaceId,
    actorId: input.userId,
    kind: "linked",
    text: `${input.target.type}:${input.target.id}`,
  });
}

export async function unlinkRecord(input: {
  workspaceId: string;
  userId: string;
  recordId: string;
  tableId: string;
  target: RecordLinkTarget;
}): Promise<void> {
  const id = linkDocId(input.recordId, input.target);
  const existing = await getDoc(doc(db, "entity_links", id));
  if (!existing.exists()) return;
  await deleteDoc(doc(db, "entity_links", id));
  await updateDoc(doc(db, TABLE_RECORDS, input.recordId), {
    linkCount: increment(-1),
    updatedAt: nowIso(),
  });
  await appendActivity({
    recordId: input.recordId,
    tableId: input.tableId,
    workspaceId: input.workspaceId,
    actorId: input.userId,
    kind: "unlinked",
    text: `${input.target.type}:${input.target.id}`,
  });
}

export async function listRecordLinks(recordId: string): Promise<RecordLinkTarget[]> {
  const snap = await getDocs(
    query(
      collection(db, "entity_links"),
      where("fromEntityType", "==", "record"),
      where("fromEntityId", "==", recordId),
    ),
  );
  return snap.docs.map((row) => {
    const data = row.data() as { toEntityType: string; toEntityId: string };
    return {
      type: data.toEntityType as RecordLinkTarget["type"],
      id: data.toEntityId,
    };
  });
}

export async function listRecordsLinkedTo(
  workspaceId: string,
  target: RecordLinkTarget,
): Promise<Array<{ recordId: string; tableId: string }>> {
  const snap = await getDocs(
    query(
      collection(db, "entity_links"),
      where("workspaceId", "==", workspaceId),
      where("toEntityType", "==", target.type),
      where("toEntityId", "==", target.id),
      where("fromEntityType", "==", "record"),
    ),
  );
  const out: Array<{ recordId: string; tableId: string }> = [];
  for (const row of snap.docs) {
    const data = row.data() as { fromEntityId: string };
    const recordSnap = await getDoc(doc(db, TABLE_RECORDS, data.fromEntityId));
    if (!recordSnap.exists()) continue;
    const record = recordSnap.data() as RecordDoc;
    out.push({ recordId: recordSnap.id, tableId: record.tableId });
  }
  return out;
}
