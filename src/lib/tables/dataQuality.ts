import type { Column, RecordValue } from "./types";

export type CellError = { columnId: string; message: string };

export function validateCell(column: Column, value: RecordValue): string | null {
  if (column.required && (value == null || value === "")) {
    return "Required";
  }
  if (column.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
    return "Invalid email";
  }
  if (column.type === "phone" && value && !/^[+()\d\s-]{7,}$/.test(String(value))) {
    return "Invalid phone";
  }
  if ((column.type === "number" || column.type === "currency") && value != null && value !== "") {
    if (!Number.isFinite(Number(value))) return "Must be a number";
  }
  if (column.type === "url" && value) {
    try {
      // eslint-disable-next-line no-new
      new URL(String(value));
    } catch {
      return "Invalid URL";
    }
  }
  return null;
}

export function validateRecordValues(
  columns: Column[],
  values: Record<string, RecordValue>,
): CellError[] {
  const errors: CellError[] = [];
  for (const col of columns) {
    const msg = validateCell(col, values[col.id] ?? null);
    if (msg) errors.push({ columnId: col.id, message: msg });
  }
  return errors;
}
