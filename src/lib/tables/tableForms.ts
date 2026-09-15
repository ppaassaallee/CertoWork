import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { createRecord } from "./storage";
import type { Column, RecordValue, TableDoc } from "./types";

export const TABLE_FORMS = "table_forms";

export type TableFormSnapshotColumn = {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  options?: Array<{ id: string; label: string; tone?: string }>;
};

export type TableFormDoc = {
  id: string;
  tableId: string;
  workspaceId: string;
  token: string;
  title: string;
  description?: string;
  columnIds: string[];
  snapshot: {
    tableName: string;
    titleColumnId: string;
    columns: TableFormSnapshotColumn[];
  };
  active: boolean;
  createdBy: string;
  createdAt: string;
  submissionCount: number;
};

function randomToken() {
  return `tf_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function publicTableFormPath(token: string) {
  return `/form/${encodeURIComponent(token)}`;
}

function buildSnapshot(table: TableDoc, columnIds: string[]) {
  const wanted = new Set(columnIds);
  return {
    tableName: table.name,
    titleColumnId: table.keyColumns.title,
    columns: table.columns
      .filter((col) => wanted.has(col.id) && !col.hidden)
      .map((col) => ({
        id: col.id,
        name: col.name,
        type: col.type,
        required: Boolean(col.required || col.id === table.keyColumns.title),
        options: col.options?.map((opt) => ({
          id: opt.id,
          label: opt.label,
          tone: opt.tone,
        })),
      })),
  };
}

export async function createTableForm(input: {
  table: TableDoc;
  userId: string;
  title?: string;
  columnIds?: string[];
}): Promise<TableFormDoc> {
  const token = randomToken();
  const columnIds =
    input.columnIds ||
    input.table.columns.filter((col) => !col.hidden).map((col) => col.id);
  const now = new Date().toISOString();
  const snapshot = buildSnapshot(input.table, columnIds);
  const payload = {
    tableId: input.table.id,
    workspaceId: input.table.workspaceId,
    token,
    title: input.title || input.table.name,
    description: "",
    columnIds,
    snapshot,
    active: true,
    revoked: false,
    createdBy: input.userId,
    userId: input.userId,
    createdAt: now,
    updatedAt: now,
    submissionCount: 0,
  };
  await setDoc(doc(db, TABLE_FORMS, token), payload);
  return { id: token, ...payload };
}

export async function listTableForms(tableId: string): Promise<TableFormDoc[]> {
  const snap = await getDocs(
    query(collection(db, TABLE_FORMS), where("tableId", "==", tableId)),
  );
  return snap.docs.map((row) => ({ id: row.id, ...(row.data() as Omit<TableFormDoc, "id">) }));
}

export async function revokeTableForm(token: string): Promise<void> {
  await updateDoc(doc(db, TABLE_FORMS, token), {
    active: false,
    revoked: true,
    updatedAt: new Date().toISOString(),
  });
}

export function formFieldsForTable(table: TableDoc, columnIds: string[]): Column[] {
  const wanted = new Set(columnIds);
  return table.columns.filter((col) => wanted.has(col.id) && !col.hidden);
}

export async function submitTableFormAsUser(input: {
  table: TableDoc;
  values: Record<string, RecordValue>;
  actorId: string;
}): Promise<string> {
  return createRecord({
    tableId: input.table.id,
    workspaceId: input.table.workspaceId,
    values: input.values,
    actorId: input.actorId,
  });
}
