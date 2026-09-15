import type { Column, RecordValue, TableDoc } from "./types";

function parseLooseNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function asIsoDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

export function coerceValue(column: Column, raw: unknown): RecordValue | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;

  switch (column.type) {
    case "text":
    case "longtext":
    case "url":
    case "email":
    case "phone":
    case "file":
    case "created_by":
      return String(raw);
    case "number":
    case "currency": {
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
      if (typeof raw === "string") return parseLooseNumber(raw) ?? null;
      return undefined;
    }
    case "date":
    case "created_at":
    case "updated_at": {
      if (typeof raw === "string") return asIsoDate(raw) ?? null;
      return undefined;
    }
    case "status":
    case "dropdown": {
      const id = String(raw);
      const allowed = (column.options || []).map((o) => o.id);
      if (!allowed.length) return id;
      return allowed.includes(id) ? id : undefined;
    }
    case "rating": {
      const n =
        typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return undefined;
      return Math.max(0, Math.min(5, Math.round(n)));
    }
    case "progress": {
      const n =
        typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return undefined;
      return Math.max(0, Math.min(100, Math.round(n)));
    }
    case "person":
      return String(raw);
    case "tags": {
      if (Array.isArray(raw)) return raw.map(String);
      if (typeof raw === "string") {
        return raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return undefined;
    }
    case "checkbox": {
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === 1 || raw === "1") return true;
      if (raw === "false" || raw === 0 || raw === "0") return false;
      return undefined;
    }
    case "relation": {
      if (Array.isArray(raw)) return raw.map(String);
      if (typeof raw === "string") return column.relation?.multiple ? [raw] : raw;
      return undefined;
    }
    default:
      return String(raw);
  }
}

export function validateRecord(
  table: Pick<TableDoc, "columns" | "keyColumns">,
  values: Record<string, RecordValue>,
): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const titleCol = table.keyColumns.title;
  const titleVal = values[titleCol];
  if (titleVal === undefined || titleVal === null || String(titleVal).trim() === "") {
    errors[titleCol] = "Title is required";
  }

  for (const column of table.columns) {
    if (!column.required) continue;
    const value = values[column.id];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) {
      errors[column.id] = `${column.name} is required`;
    } else {
      const coerced = coerceValue(column, value);
      if (coerced === undefined) {
        errors[column.id] = `${column.name} has an invalid value`;
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

const currencySymbols: Record<string, string> = {
  USD: "$",
  GTQ: "Q",
  MXN: "$",
  COP: "$",
  CLP: "$",
};

export function displayValue(
  column: Column,
  value: RecordValue,
  locale = "en",
): string {
  if (value === null || value === undefined) return "";
  switch (column.type) {
    case "checkbox":
      return value ? "✓" : "";
    case "tags":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "relation":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "status": {
      const opt = (column.options || []).find((o) => o.id === value);
      return opt?.label || String(value);
    }
    case "currency": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return String(value);
      const symbol = currencySymbols[column.currency || "USD"] || "$";
      return `${symbol}${n.toLocaleString(locale)}`;
    }
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n.toLocaleString(locale) : String(value);
    }
    case "date":
      return String(value);
    default:
      return String(value);
  }
}
