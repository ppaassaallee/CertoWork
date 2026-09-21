/**
 * Structured routine variant — same routines engine, deterministic for set/notify/create.
 * LLM only for `odysseus` language actions.
 */

export type FilterOp =
  | "is"
  | "is_not"
  | "contains"
  | "empty"
  | "not_empty"
  | "gt"
  | "lt"
  | "between"
  | "within_days"
  | "before"
  | "after"
  | "has_any"
  | "has_all";

export type StructuredTrigger =
  | { type: "record.created"; tableId: string; groupId?: string }
  | { type: "record.changed"; tableId: string; columnId: string; to?: unknown; from?: unknown }
  | { type: "record.moved"; tableId: string; toGroupId?: string }
  | { type: "date.reached"; tableId: string; columnId: string; offsetDays: number; at: string }
  | { type: "schedule"; cron: string; tz: string }
  | { type: "form.submitted"; formId: string }
  | { type: "button"; tableId: string; columnId: string };

export type StructuredAction =
  | {
      type: "set";
      columnId: string;
      value: unknown | { fn: "today" | "now" | "currentUser" | "fromColumn"; columnId?: string };
    }
  | { type: "moveToGroup"; groupId: string }
  | {
      type: "createRecord";
      tableId: string;
      groupId?: string;
      values: Record<
        string,
        unknown | { template: string } | { fromColumn: string }
      >;
      link?: { fromColumnId: string };
    }
  | {
      type: "forEachRecord";
      tableId: string;
      where: Array<{ columnId: string; op: FilterOp | "eq"; value?: unknown }>;
      actions: StructuredAction[];
    }
  | {
      type: "createItem";
      projectId?: string;
      title: { template: string };
      assigneeFromColumnId?: string;
      dueFromColumnId?: string;
    }
  | { type: "createInvoice"; title?: { template: string }; amountFromColumnId?: string }
  | {
      type: "notify";
      to: Array<{ userId?: string; fromColumnId?: string; role?: "owner" | "editors" }>;
      message: { template: string };
    }
  | {
      type: "email";
      to: { fromColumnId: string } | string[];
      subject: { template: string };
      body: { template: string };
    }
  | { type: "odysseus"; prompt: { template: string }; writeToColumnId?: string }
  | { type: "webhook"; url: string; payload: { template: string } };

export type StructuredRoutine = {
  kind: "structured";
  scope: { type: "table"; tableId: string } | { type: "workspace" };
  trigger: StructuredTrigger;
  conditions: Array<{ columnId: string; op: FilterOp; value?: unknown }>;
  actions: StructuredAction[];
  sentence: string;
  enabled: boolean;
  owner: string;
  severity?: "minor" | "major";
};

export type TableEventDoc = {
  tableId: string;
  recordId: string;
  type: string;
  columnId?: string;
  from?: unknown;
  to?: unknown;
  at?: unknown;
  by?: string;
  routineRunId?: string | null;
  workspaceId?: string;
};

const MAX_CHAIN_DEPTH = 3;

export function matchesTrigger(event: TableEventDoc, trigger: StructuredTrigger): boolean {
  if (trigger.type === "record.created") {
    return event.type === "record.created" && event.tableId === trigger.tableId;
  }
  if (trigger.type === "record.changed") {
    if (event.type !== "record.changed" || event.tableId !== trigger.tableId) return false;
    if (event.columnId !== trigger.columnId) return false;
    if (trigger.to !== undefined && event.to !== trigger.to) return false;
    if (trigger.from !== undefined && event.from !== trigger.from) return false;
    return true;
  }
  if (trigger.type === "record.moved") {
    return event.type === "record.moved" && event.tableId === trigger.tableId;
  }
  if (trigger.type === "form.submitted") {
    return event.type === "form.submitted";
  }
  return false;
}

export function loopGuardAllows(event: TableEventDoc, routineId: string, depth: number): boolean {
  if (depth >= MAX_CHAIN_DEPTH) return false;
  // Events caused by a routine run do not re-trigger the same routine.
  if (event.routineRunId && event.routineRunId === routineId) return false;
  return true;
}

export function renderTemplate(
  template: string,
  values: Record<string, unknown>,
  columnNames: Record<string, string> = {},
): string {
  let out = template;
  for (const [colId, val] of Object.entries(values)) {
    const name = columnNames[colId] || colId;
    out = out.split(`{${name}}`).join(String(val ?? ""));
    out = out.split(`{${colId}}`).join(String(val ?? ""));
  }
  return out;
}

export function resolveSetValue(
  value: StructuredAction extends { type: "set"; value: infer V } ? V : never,
  ctx: { userId: string; values: Record<string, unknown> },
): unknown {
  if (value && typeof value === "object" && "fn" in value) {
    const fn = (value as { fn: string; columnId?: string }).fn;
    if (fn === "today") return new Date().toISOString().slice(0, 10);
    if (fn === "now") return new Date().toISOString();
    if (fn === "currentUser") return ctx.userId;
    if (fn === "fromColumn" && (value as { columnId?: string }).columnId) {
      return ctx.values[(value as { columnId: string }).columnId];
    }
  }
  return value;
}

export function sentenceFromStructured(s: StructuredRoutine, columnLabel: (id: string) => string): string {
  if (s.sentence) return s.sentence;
  const t = s.trigger;
  let when = "When something happens";
  if (t.type === "record.changed") {
    when = `When ${columnLabel(t.columnId)} changes${t.to != null ? ` to ${String(t.to)}` : ""}`;
  } else if (t.type === "record.created") when = "When a record is created";
  else if (t.type === "schedule") when = `Every schedule (${t.cron})`;
  else if (t.type === "date.reached") when = `When ${columnLabel(t.columnId)} is ${t.offsetDays} days away`;
  else if (t.type === "form.submitted") when = "When the intake form is submitted";
  const acts = s.actions
    .map((a) => {
      if (a.type === "set") return `set ${columnLabel(a.columnId)}`;
      if (a.type === "notify") return "notify";
      if (a.type === "createRecord") return "create a record";
      if (a.type === "createItem") return "create an item";
      return a.type;
    })
    .join(", then ");
  return `${when}, then ${acts}`;
}
