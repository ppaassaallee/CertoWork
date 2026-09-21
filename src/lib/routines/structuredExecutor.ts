import type { RecordDoc, TableDoc } from "../tables/types";
import { updateRecordValues, createRecord } from "../tables/services/tableService";
import {
  loopGuardAllows,
  matchesTrigger,
  renderTemplate,
  resolveSetValue,
  type FilterOp,
  type StructuredAction,
  type StructuredRoutine,
  type TableEventDoc,
} from "./structured";

export type StructuredRunResult = {
  ok: boolean;
  actions: Array<{ type: string; ok: boolean; detail?: string }>;
  dryRun?: boolean;
};

/** True if a Rent collection · title already exists for the current YYYY-MM. */
async function findRentDuplicate(tableId: string, title: string): Promise<boolean> {
  const month = new Date().toISOString().slice(0, 7);
  const { listRecords } = await import("../tables/services/tableService");
  const rows = await listRecords(tableId, 2000);
  return rows.some((r) => {
    const t = String(r.title || r.values.task || r.values.name || "");
    const created = String(r.createdAt || "").slice(0, 7);
    return t === title && created === month;
  });
}

// widen forEach where op compatibility
void (null as unknown as FilterOp);

async function runAction(
  action: StructuredAction,
  ctx: {
    table: TableDoc;
    record: RecordDoc;
    userId: string;
    routineRunId: string;
    dryRun: boolean;
    columnNames: Record<string, string>;
  },
): Promise<{ type: string; ok: boolean; detail?: string }> {
  if (action.type === "set") {
    const value = resolveSetValue(action.value as never, {
      userId: ctx.userId,
      values: ctx.record.values as Record<string, unknown>,
    });
    if (ctx.dryRun) return { type: "set", ok: true, detail: `would set ${action.columnId}=${String(value)}` };
    await updateRecordValues({
      table: ctx.table,
      recordId: ctx.record.id,
      partial: { [action.columnId]: value as never },
      by: ctx.userId,
      routineRunId: ctx.routineRunId,
    });
    return { type: "set", ok: true };
  }
  if (action.type === "notify") {
    const message = renderTemplate(
      action.message.template,
      ctx.record.values as Record<string, unknown>,
      ctx.columnNames,
    );
    if (ctx.dryRun) return { type: "notify", ok: true, detail: message };
    // Inbox write — best-effort
    try {
      const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      for (const to of action.to) {
        await addDoc(collection(db, "inbox"), {
          workspaceId: ctx.table.workspaceId,
          userId: to.userId || null,
          fromColumnId: to.fromColumnId || null,
          message,
          source: "routine",
          routineRunId: ctx.routineRunId,
          createdAt: serverTimestamp(),
          read: false,
        });
      }
    } catch (e) {
      return { type: "notify", ok: false, detail: e instanceof Error ? e.message : "notify failed" };
    }
    return { type: "notify", ok: true, detail: message };
  }
  if (action.type === "createRecord") {
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(action.values)) {
      if (v && typeof v === "object" && "template" in v) {
        values[k] = renderTemplate(
          (v as { template: string }).template,
          ctx.record.values as Record<string, unknown>,
          ctx.columnNames,
        );
      } else if (v && typeof v === "object" && "fromColumn" in v) {
        values[k] = ctx.record.values[(v as { fromColumn: string }).fromColumn];
      } else values[k] = v;
    }
    // Monthly rent idempotency: skip if same title already exists this calendar month.
    const titleKey = Object.keys(values).find((k) => k === "task" || k === "name" || k === "title");
    const titleVal = titleKey ? String(values[titleKey] || "") : "";
    if (titleVal.includes("Rent collection ·") && !ctx.dryRun) {
      const dup = await findRentDuplicate(action.tableId, titleVal);
      if (dup) return { type: "createRecord", ok: true, detail: "skipped_duplicate_month" };
    }
    if (ctx.dryRun) return { type: "createRecord", ok: true, detail: JSON.stringify(values) };
    await createRecord({
      table: { ...ctx.table, id: action.tableId },
      createdBy: ctx.userId,
      values: values as never,
      groupId: action.groupId,
      routineRunId: ctx.routineRunId,
    });
    return { type: "createRecord", ok: true };
  }
  if (action.type === "forEachRecord") {
    const { listRecords } = await import("../tables/services/tableService");
    const rows = await listRecords(action.tableId, 2000);
    const matched = rows.filter((r) =>
      (action.where || []).every((cond) => {
        const v = r.values[cond.columnId];
        if (cond.op === "is" || cond.op === "eq") return v === cond.value;
        if (cond.op === "is_not") return v !== cond.value;
        return true;
      }),
    );
    if (ctx.dryRun) {
      return { type: "forEachRecord", ok: true, detail: `would iterate ${matched.length}` };
    }
    const nested: Array<{ type: string; ok: boolean; detail?: string }> = [];
    for (const row of matched) {
      for (const nestedAction of action.actions) {
        nested.push(
          await runAction(nestedAction, {
            ...ctx,
            record: row,
            table: { ...ctx.table, id: action.tableId },
          }),
        );
      }
    }
    return {
      type: "forEachRecord",
      ok: nested.every((n) => n.ok),
      detail: `iterated ${matched.length}`,
    };
  }
  if (action.type === "odysseus") {
    return { type: "odysseus", ok: true, detail: "LLM action deferred to chat path" };
  }
  if (action.type === "moveToGroup") {
    if (ctx.dryRun) return { type: "moveToGroup", ok: true, detail: action.groupId };
    const { moveRecord } = await import("../tables/services/tableService");
    await moveRecord(ctx.record.id, action.groupId, Date.now(), ctx.userId, ctx.table);
    return { type: "moveToGroup", ok: true };
  }
  return { type: action.type, ok: true, detail: "noop scaffold" };
}

/** Evaluate one structured routine against a table event (same run pipeline). */
export async function executeStructuredRoutine(input: {
  routine: StructuredRoutine & { id: string };
  event: TableEventDoc;
  table: TableDoc;
  record: RecordDoc;
  userId: string;
  depth?: number;
  dryRun?: boolean;
}): Promise<StructuredRunResult> {
  const depth = input.depth ?? 0;
  if (!input.routine.enabled && !input.dryRun) return { ok: false, actions: [] };
  if (!loopGuardAllows(input.event, input.routine.id, depth)) {
    return { ok: false, actions: [{ type: "loop_guard", ok: false, detail: "blocked" }] };
  }
  if (!matchesTrigger(input.event, input.routine.trigger)) {
    return { ok: false, actions: [] };
  }
  for (const cond of input.routine.conditions || []) {
    const v = input.record.values[cond.columnId];
    if (cond.op === "is" && v !== cond.value) return { ok: false, actions: [] };
    if (cond.op === "is_not" && v === cond.value) return { ok: false, actions: [] };
  }
  const columnNames = Object.fromEntries(input.table.columns.map((c) => [c.id, c.name]));
  const routineRunId = input.dryRun ? "dry-run" : `run_${input.routine.id}_${Date.now()}`;
  const results = [];
  for (const action of input.routine.actions) {
    results.push(
      await runAction(action, {
        table: input.table,
        record: input.record,
        userId: input.userId,
        routineRunId,
        dryRun: !!input.dryRun,
        columnNames,
      }),
    );
  }
  return { ok: results.every((r) => r.ok), actions: results, dryRun: input.dryRun };
}

export async function saveStructuredRoutine(input: {
  workspaceId: string;
  ownerUserId: string;
  tableId: string;
  tableName: string;
  structured: StructuredRoutine;
  activate?: boolean;
}): Promise<string> {
  const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
  const { db } = await import("../firebase");
  const activate = Boolean(input.activate);
  const triggerFilter: Record<string, unknown> = { tableId: input.tableId };
  if (input.structured.trigger.type === "record.changed") {
    triggerFilter.columnId = input.structured.trigger.columnId;
    if (input.structured.trigger.to !== undefined) triggerFilter.to = input.structured.trigger.to;
  }
  const ref = await addDoc(collection(db, "routines"), {
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    userId: input.ownerUserId,
    title: input.structured.sentence.slice(0, 80),
    sentence: input.structured.sentence,
    scope: { entityType: "table", entityId: input.tableId, entityTitle: input.tableName },
    trigger: {
      kind: "event",
      eventType: "table.status_changed",
      filter: triggerFilter,
      cooldownSeconds: 0,
      human: input.structured.sentence,
    },
    goal: input.structured.sentence,
    deliverable: { channel: "update_items", to: [], format: "short", language: "en" },
    permissions: {
      readCerto: "always",
      writeOwner: "always",
      editItems: "always",
      writeOthers: "ask",
      approvedActionTypes: ["set", "notify", "createRecord", "createItem"],
    },
    status: activate ? "active" : "draft",
    class: "automatic",
    structured: input.structured,
    stats: {
      runs30d: 0,
      success30d: 0,
      actions30d: 0,
      pending: 0,
      minutesSavedEstimate: 0,
      costUsd30d: 0,
    },
    nextRunAt: null,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

