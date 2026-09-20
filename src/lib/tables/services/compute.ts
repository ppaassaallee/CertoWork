import type { Column, RecordValue, TableDoc } from "../types";

/** Client-side formula/lookup/rollup compute (bounded). */
export function recomputeRecordLocal(
  table: TableDoc,
  values: Record<string, RecordValue>,
): Record<string, unknown> {
  const computed: Record<string, unknown> = {};
  for (const col of table.columns || []) {
    if (col.type === "formula" && col.config?.expression) {
      computed[col.id] = evalFormula(col.config.expression, values, table.columns);
    } else if (col.type === "createdAt" || col.type === "created_at") {
      /* leave to record */ 
    } else if (col.type === "autoNumber") {
      /* assigned on create */
    }
  }
  return computed;
}

function evalFormula(
  expression: string,
  values: Record<string, RecordValue>,
  columns: Column[],
): unknown {
  try {
    // Lazy require to keep SSR/build light if expr-eval missing
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Parser } = require("expr-eval") as typeof import("expr-eval");
    let expr = expression;
    const scope: Record<string, number | string | boolean> = {};
    for (const col of columns) {
      const token = `{${col.name}}`;
      const key = `c_${col.id.replace(/[^a-zA-Z0-9]/g, "_")}`;
      if (expr.includes(token)) expr = expr.split(token).join(key);
      const raw = values[col.id];
      if (typeof raw === "number") scope[key] = raw;
      else if (typeof raw === "boolean") scope[key] = raw;
      else if (typeof raw === "string") {
        const asNum = Number(raw);
        scope[key] = Number.isFinite(asNum) && raw.trim() !== "" ? asNum : raw;
      } else scope[key] = 0;
    }
    // Helpers
    const parser = new Parser({
      operators: { logical: true, comparison: true, concatenate: true },
    });
    parser.functions.IF = (cond: unknown, a: unknown, b: unknown) => (cond ? a : b);
    parser.functions.TODAY = () => daysSinceEpoch(new Date());
    parser.functions.DAYS = (a: number, b: number) => Math.round(b - a);
    parser.functions.ADD_DAYS = (d: number, n: number) => d + n;
    parser.functions.ROUND = (n: number, places = 0) => {
      const p = 10 ** places;
      return Math.round(n * p) / p;
    };
    parser.functions.CONCAT = (...args: unknown[]) => args.map(String).join("");
    parser.functions.LEN = (s: string) => String(s || "").length;
    parser.functions.LEFT = (s: string, n: number) => String(s || "").slice(0, n);
    parser.functions.RIGHT = (s: string, n: number) => String(s || "").slice(-n);
    parser.functions.MONTH = (d: number) => epochToDate(d).getMonth() + 1;
    parser.functions.YEAR = (d: number) => epochToDate(d).getFullYear();
    parser.functions.SUM = (...args: number[]) => args.reduce((a, b) => a + Number(b || 0), 0);
    parser.functions.MIN = (...args: number[]) => Math.min(...args.map(Number));
    parser.functions.MAX = (...args: number[]) => Math.max(...args.map(Number));
    parser.functions.AND = (...args: unknown[]) => args.every(Boolean);
    parser.functions.OR = (...args: unknown[]) => args.some(Boolean);
    parser.functions.NOT = (v: unknown) => !v;
    parser.functions.TEXT = (n: number) => String(n);
    // Convert ISO date strings in scope referenced as day numbers when expression uses DAYS/TODAY
    return parser.parse(expr).evaluate(scope as never);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "#ERR" };
  }
}

function daysSinceEpoch(d: Date) {
  return d.getTime() / 86400000;
}

function epochToDate(n: number) {
  return new Date(n * 86400000);
}

export function footerSummary(
  records: Array<{ values: Record<string, RecordValue> }>,
  column: Column,
): { kind: string; value: unknown } {
  const summary = column.summary || (column.type === "number" || column.type === "currency" ? "sum" : "none");
  if (summary === "none") return { kind: "none", value: null };
  const nums = records
    .map((r) => Number(r.values[column.id]))
    .filter((n) => Number.isFinite(n));
  if (summary === "sum") return { kind: "sum", value: nums.reduce((a, b) => a + b, 0) };
  if (summary === "avg") return { kind: "avg", value: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0 };
  if (summary === "min") return { kind: "min", value: nums.length ? Math.min(...nums) : null };
  if (summary === "max") return { kind: "max", value: nums.length ? Math.max(...nums) : null };
  if (summary === "count") return { kind: "count", value: records.length };
  if (summary === "countEmpty") {
    return {
      kind: "countEmpty",
      value: records.filter((r) => r.values[column.id] == null || r.values[column.id] === "").length,
    };
  }
  if (summary === "distribution") {
    const counts: Record<string, number> = {};
    for (const r of records) {
      const v = String(r.values[column.id] ?? "");
      counts[v] = (counts[v] || 0) + 1;
    }
    return { kind: "distribution", value: counts };
  }
  return { kind: "none", value: null };
}
