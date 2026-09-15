import type { Column, KeyColumns, StatusOption } from "../../lib/tables";
import { ensureStatusOptionTones } from "../../lib/tables/statusTones";

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = ensureStatusOptionTones([
  { id: "todo", label: "To do", tone: "neutral" },
  { id: "doing", label: "Doing", tone: "info" },
  { id: "done", label: "Done", tone: "success" },
  { id: "blocked", label: "Blocked", tone: "danger" },
]);

/** Minimal blank table: title only — add/remove columns as needed. */
export function blankTableColumns(locale: "es" | "en" = "en"): Column[] {
  const titleName = locale === "es" ? "Nombre" : "Name";
  return [
    {
      id: "title",
      name: titleName,
      type: "text",
      required: true,
      width: 260,
    },
  ];
}

export function blankKeyColumns(): KeyColumns {
  return {
    title: "title",
    status: null,
    owner: null,
    date: null,
  };
}

/** Richer starter used when someone wants a classic task-like blank. */
export function defaultTableColumns(locale: "es" | "en" = "en"): Column[] {
  if (locale === "en") {
    return [
      { id: "title", name: "Name", type: "text", required: true, width: 220 },
      {
        id: "status",
        name: "Status",
        type: "status",
        width: 140,
        options: ensureStatusOptionTones([
          { id: "todo", label: "To do", tone: "neutral" },
          { id: "doing", label: "Doing", tone: "info" },
          { id: "done", label: "Done", tone: "success" },
          { id: "blocked", label: "Blocked", tone: "danger" },
        ]),
      },
      { id: "owner", name: "Owner", type: "person", width: 160 },
      { id: "date", name: "Date", type: "date", width: 140 },
    ];
  }
  return [
    { id: "nombre", name: "Nombre", type: "text", required: true, width: 220 },
    {
      id: "estado",
      name: "Estado",
      type: "status",
      width: 140,
      options: DEFAULT_STATUS_OPTIONS,
    },
    { id: "responsable", name: "Responsable", type: "person", width: 160 },
    { id: "fecha", name: "Fecha", type: "date", width: 140 },
  ];
}

export function defaultKeyColumns(locale: "es" | "en" = "en"): KeyColumns {
  if (locale === "en") {
    return {
      title: "title",
      status: "status",
      owner: "owner",
      date: "date",
    };
  }
  return {
    title: "nombre",
    status: "estado",
    owner: "responsable",
    date: "fecha",
  };
}
