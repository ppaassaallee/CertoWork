import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase";
import type { RecordDoc, TableDoc } from "../tables/types";
import { executeStructuredRoutine } from "./structuredExecutor";
import type { StructuredRoutine, TableEventDoc } from "./structured";
import type { RoutineSpec } from "./types";

/**
 * Process a tableEvents doc against active structured routines (same engine).
 * Called from CF enqueue consumer or a client-side fallback when CF is undeployed.
 */
export async function processTableEvent(event: TableEventDoc & { id?: string }): Promise<{
  ran: number;
  skipped: number;
}> {
  if (event.routineRunId) {
    // Loop guard at intake — never re-enter from automation writes.
    return { ran: 0, skipped: 1 };
  }
  if (!event.tableId || !event.workspaceId) return { ran: 0, skipped: 0 };

  const snap = await getDocs(
    query(
      collection(db, "routines"),
      where("workspaceId", "==", event.workspaceId),
      where("status", "==", "active"),
      where("scope.entityType", "==", "table"),
      where("scope.entityId", "==", event.tableId),
      limit(40),
    ),
  );

  const tableSnap = await getDoc(doc(db, "tables", event.tableId));
  if (!tableSnap.exists()) return { ran: 0, skipped: 0 };
  const table = { id: tableSnap.id, ...(tableSnap.data() as Omit<TableDoc, "id">) };

  let record: RecordDoc | null = null;
  if (event.recordId) {
    const r = await getDoc(doc(db, "table_records", event.recordId));
    if (r.exists()) record = { id: r.id, ...(r.data() as Omit<RecordDoc, "id">) };
  }
  if (!record) return { ran: 0, skipped: 0 };

  let ran = 0;
  let skipped = 0;
  for (const row of snap.docs) {
    const routine = { id: row.id, ...(row.data() as Omit<RoutineSpec, "id">) };
    const structured = routine.structured as StructuredRoutine | null | undefined;
    if (!structured) {
      skipped += 1;
      continue;
    }
    const result = await executeStructuredRoutine({
      routine: { ...structured, id: routine.id, enabled: true },
      event,
      table,
      record,
      userId: event.by || routine.ownerUserId || table.createdBy,
      depth: 0,
    });
    if (result.ok && result.actions.length) ran += 1;
    else skipped += 1;
  }
  return { ran, skipped };
}
