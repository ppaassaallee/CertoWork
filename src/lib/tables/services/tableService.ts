import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import type { Column, RecordDoc, RecordValue, TableDoc, TableGroup } from "../types";
import { defaultGroups } from "../extendedTypes";
import { recomputeRecordLocal } from "./compute";

function nowIso() {
  return new Date().toISOString();
}

export async function createTable(input: {
  workspaceId: string;
  createdBy: string;
  name: string;
  columns: Column[];
  groups?: TableGroup[];
  titleColumnId?: string;
  icon?: string;
  color?: string;
  nounSingular?: string;
  templateId?: string | null;
}): Promise<string> {
  const groups = input.groups?.length ? input.groups : defaultGroups();
  const titleColumnId = input.titleColumnId || input.columns[0]?.id || "title";
  const ref = await addDoc(collection(db, "tables"), {
    workspaceId: input.workspaceId,
    name: input.name,
    icon: input.icon || "▦",
    color: input.color || "#2547C4",
    visibility: "workspace",
    columns: input.columns,
    keyColumns: { title: titleColumnId },
    groups,
    titleColumnId,
    nounSingular: input.nounSingular || "record",
    recordCount: 0,
    templateId: input.templateId || null,
    permissions: { visibility: "workspace", editors: [input.createdBy], viewers: [] },
    status: "active",
    createdBy: input.createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return ref.id;
}

export async function updateTableMeta(tableId: string, patch: Partial<TableDoc>): Promise<void> {
  await updateDoc(doc(db, "tables", tableId), { ...patch, updatedAt: nowIso() });
}

export async function addColumn(tableId: string, column: Column): Promise<void> {
  const snap = await getDoc(doc(db, "tables", tableId));
  if (!snap.exists()) throw new Error("table missing");
  const data = snap.data() as TableDoc;
  await updateDoc(doc(db, "tables", tableId), {
    columns: [...(data.columns || []), column],
    updatedAt: nowIso(),
  });
}

export async function updateColumn(
  tableId: string,
  columnId: string,
  patch: Partial<Column>,
): Promise<void> {
  const snap = await getDoc(doc(db, "tables", tableId));
  if (!snap.exists()) throw new Error("table missing");
  const data = snap.data() as TableDoc;
  await updateDoc(doc(db, "tables", tableId), {
    columns: (data.columns || []).map((c) => (c.id === columnId ? { ...c, ...patch } : c)),
    updatedAt: nowIso(),
  });
}

export async function removeColumn(tableId: string, columnId: string): Promise<void> {
  const snap = await getDoc(doc(db, "tables", tableId));
  if (!snap.exists()) throw new Error("table missing");
  const data = snap.data() as TableDoc;
  await updateDoc(doc(db, "tables", tableId), {
    columns: (data.columns || []).filter((c) => c.id !== columnId),
    updatedAt: nowIso(),
  });
}

export async function addGroup(tableId: string, group: TableGroup): Promise<void> {
  const snap = await getDoc(doc(db, "tables", tableId));
  if (!snap.exists()) throw new Error("table missing");
  const data = snap.data() as TableDoc;
  await updateDoc(doc(db, "tables", tableId), {
    groups: [...(data.groups || defaultGroups()), group],
    updatedAt: nowIso(),
  });
}

export async function createRecord(input: {
  table: TableDoc;
  createdBy: string;
  values?: Record<string, RecordValue>;
  groupId?: string;
  routineRunId?: string | null;
}): Promise<string> {
  const titleCol =
    input.table.titleColumnId || input.table.keyColumns?.title || input.table.columns[0]?.id;
  const values = { ...(input.values || {}) };
  const title = String(values[titleCol || ""] || "Untitled");
  const groupId = input.groupId || input.table.groups?.[0]?.id || "g-default";
  const computed = recomputeRecordLocal(input.table, values);
  const ref = await addDoc(collection(db, "table_records"), {
    tableId: input.table.id,
    workspaceId: input.table.workspaceId,
    values,
    computed,
    groupId,
    title,
    order: Date.now(),
    createdBy: input.createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    updatedBy: input.createdBy,
    routineRunId: input.routineRunId || null,
  });
  await updateDoc(doc(db, "tables", input.table.id), {
    recordCount: (input.table.recordCount || 0) + 1,
    updatedAt: nowIso(),
  });
  await addDoc(collection(db, "tableEvents"), {
    tableId: input.table.id,
    recordId: ref.id,
    type: "record.created",
    workspaceId: input.table.workspaceId,
    at: serverTimestamp(),
    by: input.createdBy,
    routineRunId: input.routineRunId || null,
  });
  return ref.id;
}

export async function updateRecordValues(input: {
  table: TableDoc;
  recordId: string;
  partial: Record<string, RecordValue>;
  by: string;
  routineRunId?: string | null;
}): Promise<void> {
  const ref = doc(db, "table_records", input.recordId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("record missing");
  const prev = snap.data() as RecordDoc;
  const values = { ...prev.values, ...input.partial };
  const titleCol = input.table.titleColumnId || input.table.keyColumns?.title;
  const title = titleCol ? String(values[titleCol] || prev.title || "") : prev.title;
  const computed = recomputeRecordLocal(input.table, values);
  await updateDoc(ref, {
    values,
    computed,
    title,
    updatedAt: nowIso(),
    updatedBy: input.by,
    routineRunId: input.routineRunId || null,
  });
  for (const [columnId, to] of Object.entries(input.partial)) {
    const from = prev.values?.[columnId] ?? null;
    await addDoc(collection(db, "tableEvents"), {
      tableId: input.table.id,
      recordId: input.recordId,
      type: "record.changed",
      columnId,
      from,
      to,
      workspaceId: input.table.workspaceId,
      at: serverTimestamp(),
      by: input.by,
      routineRunId: input.routineRunId || null,
    });
    await addDoc(collection(db, "table_record_activity"), {
      recordId: input.recordId,
      tableId: input.table.id,
      workspaceId: input.table.workspaceId,
      actorId: input.by,
      kind: input.routineRunId ? "automation" : "field_changed",
      columnId,
      from,
      to,
      routineId: input.routineRunId || null,
      createdAt: nowIso(),
    });
  }
}

export async function moveRecord(
  recordId: string,
  groupId: string,
  order: number,
  by: string,
  table: TableDoc,
): Promise<void> {
  await updateDoc(doc(db, "table_records", recordId), {
    groupId,
    order,
    updatedAt: nowIso(),
    updatedBy: by,
  });
  await addDoc(collection(db, "tableEvents"), {
    tableId: table.id,
    recordId,
    type: "record.moved",
    toGroupId: groupId,
    workspaceId: table.workspaceId,
    at: serverTimestamp(),
    by,
  });
}

export async function deleteRecords(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const id of ids) batch.delete(doc(db, "table_records", id));
  await batch.commit();
}

export async function listRecords(tableId: string, max = 500): Promise<RecordDoc[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "table_records"),
        where("tableId", "==", tableId),
        orderBy("order", "asc"),
        limit(max),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RecordDoc, "id">) }));
  } catch {
    const snap = await getDocs(
      query(collection(db, "table_records"), where("tableId", "==", tableId), limit(max)),
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<RecordDoc, "id">) }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }
}

export async function softDeleteTable(tableId: string): Promise<void> {
  const purge = new Date();
  purge.setDate(purge.getDate() + 30);
  await updateDoc(doc(db, "tables", tableId), {
    status: "deleted",
    deletedAt: nowIso(),
    purgeAfter: purge.toISOString(),
    updatedAt: nowIso(),
  });
}

export async function duplicateTable(
  tableId: string,
  createdBy: string,
  withRecords = false,
): Promise<string> {
  const snap = await getDoc(doc(db, "tables", tableId));
  if (!snap.exists()) throw new Error("table missing");
  const t = { id: snap.id, ...(snap.data() as Omit<TableDoc, "id">) };
  const newId = await createTable({
    workspaceId: t.workspaceId,
    createdBy,
    name: `${t.name} (copy)`,
    columns: t.columns,
    groups: t.groups,
    titleColumnId: t.titleColumnId,
    icon: t.icon,
    color: t.color,
    nounSingular: t.nounSingular,
  });
  if (withRecords) {
    const rows = await listRecords(tableId, 2000);
    for (const r of rows) {
      await createRecord({
        table: { ...t, id: newId },
        createdBy,
        values: r.values,
        groupId: r.groupId,
      });
    }
  }
  return newId;
}
