import Papa from "papaparse";
import type { Column, ColumnType, RecordValue } from "../types";

export type ImportPreview = {
  headers: string[];
  rows: string[][];
  inferred: Array<{ name: string; type: ColumnType }>;
};

export function inferColumnType(values: string[]): ColumnType {
  const nonempty = values.filter((v) => v != null && String(v).trim() !== "");
  if (!nonempty.length) return "text";
  if (nonempty.every((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) return "email";
  if (nonempty.every((v) => /^[+()\d\s-]{7,}$/.test(v))) return "phone";
  if (nonempty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v) || !Number.isNaN(Date.parse(v)))) {
    return "date";
  }
  if (nonempty.every((v) => Number.isFinite(Number(String(v).replace(/[$,]/g, ""))))) {
    return "number";
  }
  const distinct = new Set(nonempty.map((v) => v.trim()));
  if (distinct.size <= 12 && nonempty.length >= 3) return "status";
  return "text";
}

export function parseCsv(text: string): ImportPreview {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const data = (parsed.data || []) as string[][];
  const headers = (data[0] || []).map((h, i) => String(h || `Column ${i + 1}`));
  const rows = data.slice(1);
  const inferred = headers.map((name, i) => ({
    name,
    type: inferColumnType(rows.map((r) => String(r[i] ?? ""))),
  }));
  return { headers, rows, inferred };
}

export function previewToColumns(inferred: ImportPreview["inferred"]): Column[] {
  return inferred.map((c, i) => ({
    id: `c${i}_${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24)}`,
    name: c.name,
    type: c.type,
    width: 160,
    summary: c.type === "number" || c.type === "currency" ? "sum" : c.type === "status" ? "distribution" : "none",
    ...(c.type === "status"
      ? {
          options: [],
          config: { options: [] },
        }
      : {}),
  }));
}

export function rowsToValues(
  columns: Column[],
  rows: string[][],
): Array<Record<string, RecordValue>> {
  return rows.map((row) => {
    const values: Record<string, RecordValue> = {};
    columns.forEach((col, i) => {
      const raw = row[i] ?? "";
      if (col.type === "number" || col.type === "currency") {
        values[col.id] = Number(String(raw).replace(/[$,]/g, "")) || 0;
      } else if (col.type === "checkbox") {
        values[col.id] = /^(1|true|yes|y)$/i.test(String(raw));
      } else {
        values[col.id] = String(raw);
      }
    });
    return values;
  });
}

export function exportCsv(
  columns: Column[],
  rows: Array<Record<string, RecordValue>>,
): string {
  const headers = columns.map((c) => c.name);
  const data = rows.map((r) => columns.map((c) => String(r[c.id] ?? "")));
  return Papa.unparse({ fields: headers, data });
}

/** XLSX via SheetJS when available — CSV fallback. */
export async function parseWorkbook(file: File): Promise<ImportPreview> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || file.type.includes("csv")) {
    return parseCsv(await file.text());
  }
  try {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return parseCsv(csv);
  } catch {
    return parseCsv(await file.text());
  }
}
