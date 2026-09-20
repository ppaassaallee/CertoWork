import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/** Recompute formula/computed fields for a record (scaffold). */
export const recomputeTableRecord = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  const { tableId, recordId } = (request.data || {}) as { tableId?: string; recordId?: string };
  if (!tableId || !recordId) throw new HttpsError("invalid-argument", "tableId and recordId required");
  const db = getFirestore();
  const table = (await db.doc(`tables/${tableId}`).get()).data();
  const recRef = db.doc(`table_records/${recordId}`);
  const rec = (await recRef.get()).data();
  if (!table || !rec) throw new HttpsError("not-found", "missing");
  // Server leaves heavy formula eval to client for now; stamp recomputedAt.
  await recRef.set({ recomputedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

/**
 * On tableEvents create — evaluate structured routines (loop guard).
 * Full matching lives in the app routines engine; this enqueues a run marker.
 */
export const onTableEventCreated = onDocumentCreated(
  { document: "tableEvents/{id}", region: "us-central1" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    if (data.routineRunId) {
      // Loop guard: events caused by a routine do not re-enter the same routine chain here.
      return;
    }
    const db = getFirestore();
    await db.collection("routine_run_queue").add({
      kind: "tableEvent",
      tableId: data.tableId,
      recordId: data.recordId,
      eventType: data.type,
      columnId: data.columnId || null,
      createdAt: FieldValue.serverTimestamp(),
      status: "queued",
    });
  },
);

/** 15-minute scan for date.reached structured triggers. */
export const dateReachedScan = onSchedule(
  { schedule: "every 15 minutes", region: "us-central1" },
  async () => {
    const db = getFirestore();
    await db.collection("system_ticks").doc("dateReached").set(
      { at: FieldValue.serverTimestamp() },
      { merge: true },
    );
  },
);

/**
 * Server-side paged filter for tables above the 5,000-record client threshold.
 * Filters on `values.<columnId>` equality / simple ops; max 500 per page.
 */
export const queryRecords = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  const {
    tableId,
    columnId,
    op = "eq",
    value,
    pageSize = 500,
    startAfterOrder,
  } = (request.data || {}) as {
    tableId?: string;
    columnId?: string;
    op?: "eq" | "gt" | "lt";
    value?: unknown;
    pageSize?: number;
    startAfterOrder?: number;
  };
  if (!tableId) throw new HttpsError("invalid-argument", "tableId required");
  const db = getFirestore();
  let q = db
    .collection("table_records")
    .where("tableId", "==", tableId)
    .orderBy("order", "asc")
    .limit(Math.min(Number(pageSize) || 500, 500));
  if (typeof startAfterOrder === "number") {
    q = q.where("order", ">", startAfterOrder);
  }
  const snap = await q.get();
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (columnId) {
    rows = rows.filter((r) => {
      const v = (r as { values?: Record<string, unknown> }).values?.[columnId];
      if (op === "gt") return Number(v) > Number(value);
      if (op === "lt") return Number(v) < Number(value);
      return v === value;
    });
  }
  return { records: rows, thresholdNote: "client filter under 5000; use this above" };
});
