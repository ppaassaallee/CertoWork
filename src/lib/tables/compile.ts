import type { Column, ColumnType, KeyColumns, StatusOption } from "./types";

export type CompiledTableSchema = {
  name: string;
  icon: string;
  columns: Column[];
  keyColumns: KeyColumns;
  statusOptions: StatusOption[];
};

export type CompileTableResult = {
  schema?: CompiledTableSchema;
  question?: string;
};

const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { id: "todo", label: "Por hacer", tone: "neutral" },
  { id: "doing", label: "En curso", tone: "info" },
  { id: "done", label: "Hecho", tone: "success" },
  { id: "blocked", label: "Bloqueado", tone: "danger" },
];

const COLUMN_TYPE_HINTS: Array<{ type: ColumnType; pattern: RegExp }> = [
  {
    type: "status",
    pattern: /^(estado|status|etapa|stage|fase|phase)$/i,
  },
  {
    type: "person",
    pattern:
      /^(responsable|owner|due[nñ]o|assignee|persona|buddy|account|solicitante)$/i,
  },
  {
    type: "date",
    pattern:
      /^(fecha|date|cierre|renovaci[oó]n|renewal|vence|expires?|inicio|deadline|revisi[oó]n|review|contacto|contact)$/i,
  },
  {
    type: "currency",
    pattern: /^(monto|amount|precio|price|costo|cost|valor|value|budget)$/i,
  },
  {
    type: "number",
    pattern: /^(monto|cantidad|qty|quantity|progreso|progress|score|%|numero|number)$/i,
  },
  {
    type: "email",
    pattern: /^(email|correo|mail)$/i,
  },
  {
    type: "phone",
    pattern: /^(tel[eé]fono|phone|celular|mobile|whatsapp)$/i,
  },
  {
    type: "url",
    pattern: /^(url|link|web|sitio|website)$/i,
  },
  {
    type: "tags",
    pattern: /^(tags?|etiquetas?|labels?|ciclo|cycle|nivel|level)$/i,
  },
  {
    type: "checkbox",
    pattern: /^(hecho|done|ok|check|activo|active)$/i,
  },
  {
    type: "longtext",
    pattern: /^(notas?|notes?|detalle|detail|descripci[oó]n|description|comentario)$/i,
  },
];

const ICON_BY_NAME: Array<{ pattern: RegExp; icon: string }> = [
  { pattern: /pipeline|oportun|ventas|sales|deal/i, icon: "◇" },
  { pattern: /proveedor|vendor|suscrip|subscri/i, icon: "▣" },
  { pattern: /onboard|persona|people|hire|alta/i, icon: "◎" },
  { pattern: /riesgo|risk/i, icon: "⚠" },
  { pattern: /pedido|request|solicitud|ticket/i, icon: "▸" },
  { pattern: /cliente|client|contacto|contact/i, icon: "◉" },
  { pattern: /acceso|access|permiso|permission/i, icon: "⬡" },
  { pattern: /okr|objetivo|objective|meta/i, icon: "✦" },
];

function slugId(name: string, used: Set<string>): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 28);
  let id = base || "col";
  let n = 2;
  while (used.has(id)) {
    id = `${base || "col"}_${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function titleCase(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Sin título";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function inferColumnType(name: string): ColumnType {
  for (const hint of COLUMN_TYPE_HINTS) {
    if (hint.pattern.test(name.trim())) return hint.type;
  }
  if (/fecha|date|vence|renov/i.test(name)) return "date";
  if (/responsable|owner|dueño|persona/i.test(name)) return "person";
  if (/estado|status|etapa/i.test(name)) return "status";
  if (/monto|precio|costo|usd|gtq/i.test(name)) return "currency";
  return "text";
}

function inferIcon(name: string): string {
  for (const row of ICON_BY_NAME) {
    if (row.pattern.test(name)) return row.icon;
  }
  return "▦";
}

function splitColumnTokens(phrase: string): string[] {
  // "proveedores con nombre, estado, responsable, renovación y monto"
  const conMatch = phrase.match(
    /\b(?:con|with|columns?|columnas?)\s+(.+)$/i,
  );
  const listPart = conMatch ? conMatch[1] : "";
  if (!listPart) return [];

  return listPart
    .split(/,|\by\b|\band\b|&/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^(el|la|los|las|the|a|an)\s+/i, "").trim())
    .filter(Boolean);
}

function extractName(phrase: string): string {
  const trimmed = phrase.trim();
  const withoutPrefix = trimmed
    .replace(/^(crea(r)?|create|hac[eé]|arma|build|nueva?\s+tabla|new\s+table|tabla|table)\s+(de|of|para|for|con|with)?\s*/i, "")
    .trim();

  const beforeCon = withoutPrefix.split(/\b(?:con|with|columns?|columnas?)\b/i)[0] || withoutPrefix;
  const name = beforeCon.replace(/[:.]+$/, "").trim();
  if (name.length >= 2 && name.length <= 80) return titleCase(name);
  return "";
}

export function validateCompiledTableSchema(
  raw: unknown,
): { ok: true; schema: CompiledTableSchema } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "schema must be an object" };
  }
  const input = raw as Record<string, unknown>;
  const name = String(input.name || "").trim();
  if (!name || name.length > 80) {
    return { ok: false, error: "name is required (max 80 chars)" };
  }
  const icon = String(input.icon || "▦").trim().slice(0, 4) || "▦";

  if (!Array.isArray(input.columns) || input.columns.length < 1) {
    return { ok: false, error: "columns must be a non-empty array" };
  }
  if (input.columns.length > 24) {
    return { ok: false, error: "too many columns (max 24)" };
  }

  const usedIds = new Set<string>();
  const columns: Column[] = [];
  for (const row of input.columns) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "each column must be an object" };
    }
    const col = row as Record<string, unknown>;
    const colName = String(col.name || "").trim();
    if (!colName) return { ok: false, error: "column.name is required" };
    const id = String(col.id || slugId(colName, usedIds)).trim();
    if (!id) return { ok: false, error: "column.id is required" };
    usedIds.add(id);
    const type = String(col.type || "text") as ColumnType;
    const allowed: ColumnType[] = [
      "text",
      "longtext",
      "number",
      "currency",
      "date",
      "status",
      "person",
      "tags",
      "checkbox",
      "url",
      "email",
      "phone",
      "file",
      "relation",
      "created_at",
      "created_by",
      "updated_at",
    ];
    if (!allowed.includes(type)) {
      return { ok: false, error: `unsupported column type: ${type}` };
    }
    const next: Column = {
      id,
      name: colName,
      type,
      ...(typeof col.width === "number" ? { width: col.width } : {}),
      ...(col.required ? { required: true } : {}),
    };
    if (type === "status") {
      const options = Array.isArray(col.options)
        ? (col.options as StatusOption[])
        : DEFAULT_STATUS_OPTIONS;
      next.options = options;
    }
    if (type === "currency" && (col.currency === "USD" || col.currency === "GTQ" || col.currency === "MXN" || col.currency === "COP" || col.currency === "CLP")) {
      next.currency = col.currency;
    }
    if (type === "tags" && Array.isArray(col.tagOptions)) {
      next.tagOptions = col.tagOptions.map(String);
    }
    columns.push(next);
  }

  const statusOptions = Array.isArray(input.statusOptions)
    ? (input.statusOptions as StatusOption[])
    : columns.find((c) => c.type === "status")?.options || DEFAULT_STATUS_OPTIONS;

  const keyRaw =
    input.keyColumns && typeof input.keyColumns === "object"
      ? (input.keyColumns as Record<string, unknown>)
      : {};
  const titleId = String(keyRaw.title || columns[0]?.id || "").trim();
  if (!titleId || !columns.some((c) => c.id === titleId)) {
    return { ok: false, error: "keyColumns.title must reference a column" };
  }
  const pickOptional = (key: string, type: ColumnType): string | null => {
    const value = keyRaw[key];
    if (value === null || value === undefined || value === "") return null;
    const id = String(value);
    if (!columns.some((c) => c.id === id && c.type === type)) return null;
    return id;
  };

  const keyColumns: KeyColumns = {
    title: titleId,
    status: pickOptional("status", "status"),
    owner: pickOptional("owner", "person"),
    date: pickOptional("date", "date"),
  };

  // Auto-fill missing keys from first matching columns
  if (!keyColumns.status) {
    keyColumns.status = columns.find((c) => c.type === "status")?.id || null;
  }
  if (!keyColumns.owner) {
    keyColumns.owner = columns.find((c) => c.type === "person")?.id || null;
  }
  if (!keyColumns.date) {
    keyColumns.date = columns.find((c) => c.type === "date")?.id || null;
  }

  return {
    ok: true,
    schema: {
      name,
      icon,
      columns,
      keyColumns,
      statusOptions,
    },
  };
}

/**
 * Deterministic Spanish/English phrase → table schema compiler.
 * Examples:
 *  - "proveedores con nombre, estado, responsable, renovación y monto"
 *  - "sales pipeline with deal, status, owner, amount and close date"
 */
export function compileTablePhrase(input: {
  phrase: string;
  locale?: "es" | "en";
}): CompileTableResult {
  const phrase = String(input.phrase || "").trim();
  const locale = input.locale === "en" ? "en" : "es";

  if (!phrase) {
    return {
      question:
        locale === "en"
          ? "What should this table track, and which columns do you need?"
          : "¿Qué debería rastrear esta tabla y qué columnas necesitás?",
    };
  }

  if (phrase.length > 500) {
    return {
      question:
        locale === "en"
          ? "Can you shorten that to a name plus a few column names?"
          : "¿Podés acortarlo a un nombre y unas pocas columnas?",
    };
  }

  const name = extractName(phrase);
  const tokens = splitColumnTokens(phrase);

  if (!name && tokens.length === 0) {
    return {
      question:
        locale === "en"
          ? "Give me a table name and columns, e.g. “vendors with name, status, owner, renewal and amount”."
          : "Dame un nombre y columnas, p. ej. “proveedores con nombre, estado, responsable, renovación y monto”.",
    };
  }

  if (tokens.length === 0) {
    return {
      question:
        locale === "en"
          ? `Got “${name || "table"}”. Which columns should it have?`
          : `Entendí “${name || "tabla"}”. ¿Qué columnas debería tener?`,
    };
  }

  const used = new Set<string>();
  const columns: Column[] = tokens.map((token, index) => {
    const type = inferColumnType(token);
    const id = slugId(token, used);
    const column: Column = {
      id,
      name: titleCase(token),
      type,
      width: type === "text" || type === "longtext" ? 200 : 140,
      ...(index === 0 ? { required: true } : {}),
    };
    if (type === "status") {
      column.options = DEFAULT_STATUS_OPTIONS.map((o) => ({ ...o }));
    }
    if (type === "currency") {
      column.currency = "USD";
    }
    return column;
  });

  // Ensure there is a title text column
  if (!columns.some((c) => c.type === "text")) {
    const id = slugId("nombre", used);
    columns.unshift({
      id,
      name: locale === "en" ? "Name" : "Nombre",
      type: "text",
      required: true,
      width: 200,
    });
  }

  const titleCol = columns.find((c) => c.type === "text") || columns[0];
  const statusCol = columns.find((c) => c.type === "status");
  const ownerCol = columns.find((c) => c.type === "person");
  const dateCol = columns.find((c) => c.type === "date");

  const schema: CompiledTableSchema = {
    name: name || titleCase(tokens[0] || (locale === "en" ? "Table" : "Tabla")),
    icon: inferIcon(name || phrase),
    columns,
    keyColumns: {
      title: titleCol.id,
      status: statusCol?.id || null,
      owner: ownerCol?.id || null,
      date: dateCol?.id || null,
    },
    statusOptions: statusCol?.options || DEFAULT_STATUS_OPTIONS,
  };

  const validated = validateCompiledTableSchema(schema);
  if (!validated.ok) {
    return {
      question:
        locale === "en"
          ? "I could not build a valid schema. Try naming the table and listing columns."
          : "No pude armar un esquema válido. Probá con nombre y lista de columnas.",
    };
  }

  return { schema: validated.schema };
}
