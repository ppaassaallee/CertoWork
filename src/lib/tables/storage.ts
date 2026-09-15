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
import {
  RECORD_ACTIVITY,
  RECORD_LINK_RELATION,
  TABLE_RECORDS,
  TABLES,
  type Column,
  type KeyColumns,
  type RecordDoc,
  type RecordLinkTarget,
  type RecordValue,
  type TableDoc,
  type TableVisibility,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function linkDocId(recordId: string, target: RecordLinkTarget) {
  return `${recordId}__${target.type}__${target.id}`;
}

export function canSeeTable(
  table: Pick<TableDoc, "visibility" | "createdBy" | "projectId">,
  uid: string,
  projectIds: string[],
): boolean {
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
  const ref = await addDoc(collection(db, TABLES), {
    ...rest,
    // Keep userId in sync with createdBy so workspace listeners that filter by userId still match.
    userId: explicitUserId || rest.createdBy,
    recordCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateTableColumns(
  tableId: string,
  columns: Column[],
  keyColumns: KeyColumns,
): Promise<void> {
  await updateDoc(doc(db, TABLES, tableId), {
    columns,
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

export async function deleteRecord(tableId: string, recordId: string): Promise<void> {
  const activitySnap = await getDocs(
    query(collection(db, RECORD_ACTIVITY), where("recordId", "==", recordId)),
  );
  const linksSnap = await getDocs(
    query(
      collection(db, "entity_links"),
      where("fromEntityType", "==", "record"),
      where("fromEntityId", "==", recordId),
    ),
  );

  const batch = writeBatch(db);
  for (const row of activitySnap.docs) batch.delete(row.ref);
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
