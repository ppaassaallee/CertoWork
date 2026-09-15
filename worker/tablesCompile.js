/**
 * Deterministic table phrase compiler for the Cloudflare worker.
 * Kept in sync with src/lib/tables/compile.ts
 */

const DEFAULT_STATUS_OPTIONS = [
  { id: "todo", label: "Por hacer", tone: "neutral" },
  { id: "doing", label: "En curso", tone: "info" },
  { id: "done", label: "Hecho", tone: "success" },
  { id: "blocked", label: "Bloqueado", tone: "danger" },
];

const COLUMN_TYPE_HINTS = [
  { type: "status", pattern: /^(estado|status|etapa|stage|fase|phase)$/i },
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
  { type: "email", pattern: /^(email|correo|mail)$/i },
  { type: "phone", pattern: /^(tel[eé]fono|phone|celular|mobile|whatsapp)$/i },
  { type: "url", pattern: /^(url|link|web|sitio|website)$/i },
  { type: "tags", pattern: /^(tags?|etiquetas?|labels?|ciclo|cycle|nivel|level)$/i },
  { type: "checkbox", pattern: /^(hecho|done|ok|check|activo|active)$/i },
  {
    type: "longtext",
    pattern: /^(notas?|notes?|detalle|detail|descripci[oó]n|description|comentario)$/i,
  },
];

const ICON_BY_NAME = [
  { pattern: /pipeline|oportun|ventas|sales|deal/i, icon: "◇" },
  { pattern: /proveedor|vendor|suscrip|subscri/i, icon: "▣" },
  { pattern: /onboard|persona|people|hire|alta/i, icon: "◎" },
  { pattern: /riesgo|risk/i, icon: "⚠" },
  { pattern: /pedido|request|solicitud|ticket/i, icon: "▸" },
  { pattern: /cliente|client|contacto|contact/i, icon: "◉" },
  { pattern: /acceso|access|permiso|permission/i, icon: "⬡" },
  { pattern: /okr|objetivo|objective|meta/i, icon: "✦" },
];

const ALLOWED_TYPES = new Set([
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
]);

function slugId(name, used) {
  const base = String(name || "")
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

function titleCase(raw) {
  const cleaned = String(raw || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "Sin título";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function inferColumnType(name) {
  for (const hint of COLUMN_TYPE_HINTS) {
    if (hint.pattern.test(String(name || "").trim())) return hint.type;
  }
  if (/fecha|date|vence|renov/i.test(name)) return "date";
  if (/responsable|owner|dueño|persona/i.test(name)) return "person";
  if (/estado|status|etapa/i.test(name)) return "status";
  if (/monto|precio|costo|usd|gtq/i.test(name)) return "currency";
  return "text";
}

function inferIcon(name) {
  for (const row of ICON_BY_NAME) {
    if (row.pattern.test(name)) return row.icon;
  }
  return "▦";
}

function splitColumnTokens(phrase) {
  const conMatch = String(phrase).match(/\b(?:con|with|columns?|columnas?)\s+(.+)$/i);
  const listPart = conMatch ? conMatch[1] : "";
  if (!listPart) return [];
  return listPart
    .split(/,|\by\b|\band\b|&/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^(el|la|los|las|the|a|an)\s+/i, "").trim())
    .filter(Boolean);
}

function extractName(phrase) {
  const trimmed = String(phrase || "").trim();
  const withoutPrefix = trimmed
    .replace(
      /^(crea(r)?|create|hac[eé]|arma|build|nueva?\s+tabla|new\s+table|tabla|table)\s+(de|of|para|for|con|with)?\s*/i,
      "",
    )
    .trim();
  const beforeCon =
    withoutPrefix.split(/\b(?:con|with|columns?|columnas?)\b/i)[0] || withoutPrefix;
  const name = beforeCon.replace(/[:.]+$/, "").trim();
  if (name.length >= 2 && name.length <= 80) return titleCase(name);
  return "";
}

export function validateCompiledTableSchema(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "schema must be an object" };
  }
  const name = String(raw.name || "").trim();
  if (!name || name.length > 80) {
    return { ok: false, error: "name is required (max 80 chars)" };
  }
  const icon = String(raw.icon || "▦").trim().slice(0, 4) || "▦";
  if (!Array.isArray(raw.columns) || raw.columns.length < 1) {
    return { ok: false, error: "columns must be a non-empty array" };
  }
  if (raw.columns.length > 24) {
    return { ok: false, error: "too many columns (max 24)" };
  }

  const usedIds = new Set();
  const columns = [];
  for (const row of raw.columns) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "each column must be an object" };
    }
    const colName = String(row.name || "").trim();
    if (!colName) return { ok: false, error: "column.name is required" };
    const id = String(row.id || slugId(colName, usedIds)).trim();
    if (!id) return { ok: false, error: "column.id is required" };
    usedIds.add(id);
    const type = String(row.type || "text");
    if (!ALLOWED_TYPES.has(type)) {
      return { ok: false, error: `unsupported column type: ${type}` };
    }
    const next = {
      id,
      name: colName,
      type,
      ...(typeof row.width === "number" ? { width: row.width } : {}),
      ...(row.required ? { required: true } : {}),
    };
    if (type === "status") {
      next.options = Array.isArray(row.options) ? row.options : DEFAULT_STATUS_OPTIONS;
    }
    if (
      type === "currency" &&
      ["USD", "GTQ", "MXN", "COP", "CLP"].includes(row.currency)
    ) {
      next.currency = row.currency;
    }
    if (type === "tags" && Array.isArray(row.tagOptions)) {
      next.tagOptions = row.tagOptions.map(String);
    }
    columns.push(next);
  }

  const statusOptions = Array.isArray(raw.statusOptions)
    ? raw.statusOptions
    : columns.find((c) => c.type === "status")?.options || DEFAULT_STATUS_OPTIONS;

  const keyRaw =
    raw.keyColumns && typeof raw.keyColumns === "object" ? raw.keyColumns : {};
  const titleId = String(keyRaw.title || columns[0]?.id || "").trim();
  if (!titleId || !columns.some((c) => c.id === titleId)) {
    return { ok: false, error: "keyColumns.title must reference a column" };
  }

  const pickOptional = (key, type) => {
    const value = keyRaw[key];
    if (value === null || value === undefined || value === "") return null;
    const id = String(value);
    if (!columns.some((c) => c.id === id && c.type === type)) return null;
    return id;
  };

  const keyColumns = {
    title: titleId,
    status: pickOptional("status", "status"),
    owner: pickOptional("owner", "person"),
    date: pickOptional("date", "date"),
  };
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
    schema: { name, icon, columns, keyColumns, statusOptions },
  };
}

export function compileTablePhrase({ phrase, locale = "es" } = {}) {
  const text = String(phrase || "").trim();
  const lang = locale === "en" ? "en" : "es";

  if (!text) {
    return {
      question:
        lang === "en"
          ? "What should this table track, and which columns do you need?"
          : "¿Qué debería rastrear esta tabla y qué columnas necesitás?",
    };
  }
  if (text.length > 500) {
    return {
      question:
        lang === "en"
          ? "Can you shorten that to a name plus a few column names?"
          : "¿Podés acortarlo a un nombre y unas pocas columnas?",
    };
  }

  const name = extractName(text);
  const tokens = splitColumnTokens(text);

  if (!name && tokens.length === 0) {
    return {
      question:
        lang === "en"
          ? "Give me a table name and columns, e.g. “vendors with name, status, owner, renewal and amount”."
          : "Dame un nombre y columnas, p. ej. “proveedores con nombre, estado, responsable, renovación y monto”.",
    };
  }

  if (tokens.length === 0) {
    return {
      question:
        lang === "en"
          ? `Got “${name || "table"}”. Which columns should it have?`
          : `Entendí “${name || "tabla"}”. ¿Qué columnas debería tener?`,
    };
  }

  const used = new Set();
  const columns = tokens.map((token, index) => {
    const type = inferColumnType(token);
    const id = slugId(token, used);
    const column = {
      id,
      name: titleCase(token),
      type,
      width: type === "text" || type === "longtext" ? 200 : 140,
      ...(index === 0 ? { required: true } : {}),
    };
    if (type === "status") {
      column.options = DEFAULT_STATUS_OPTIONS.map((o) => ({ ...o }));
    }
    if (type === "currency") column.currency = "USD";
    return column;
  });

  if (!columns.some((c) => c.type === "text")) {
    const id = slugId("nombre", used);
    columns.unshift({
      id,
      name: lang === "en" ? "Name" : "Nombre",
      type: "text",
      required: true,
      width: 200,
    });
  }

  const titleCol = columns.find((c) => c.type === "text") || columns[0];
  const statusCol = columns.find((c) => c.type === "status");
  const ownerCol = columns.find((c) => c.type === "person");
  const dateCol = columns.find((c) => c.type === "date");

  const schema = {
    name: name || titleCase(tokens[0] || (lang === "en" ? "Table" : "Tabla")),
    icon: inferIcon(name || text),
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
        lang === "en"
          ? "I could not build a valid schema. Try naming the table and listing columns."
          : "No pude armar un esquema válido. Probá con nombre y lista de columnas.",
    };
  }
  return { schema: validated.schema };
}

export function tableCompileInstructions() {
  return `You are Certo Work's table schema compiler. Turn a short natural-language request into one JSON object.

Return exactly this shape:
{
  "name": "",
  "icon": "▦",
  "columns": [{"id":"","name":"","type":"text|longtext|number|currency|date|status|person|tags|checkbox|url|email|phone","required":false,"options":[{"id":"","label":"","tone":"neutral|info|success|warning|danger|purple"}]}],
  "keyColumns": {"title":"","status":null,"owner":null,"date":null},
  "statusOptions": [{"id":"","label":"","tone":"neutral"}],
  "question": null
}

Rules:
- Preserve the user's language for name and column labels.
- Infer sensible column types from names (estado→status, responsable→person, fecha/renovación→date, monto→currency).
- keyColumns.title must reference a text column id. status/owner/date may be null.
- If the phrase is too vague to build columns, set "question" to ONE short clarification and leave columns empty.
- Prefer 3–8 columns. Do not invent automations.
- Return JSON only.`;
}
