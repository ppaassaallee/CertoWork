import type { Column, KeyColumns, StatusOption } from "../../lib/tables";

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { id: "todo", label: "To do", tone: "neutral" },
  { id: "doing", label: "Doing", tone: "info" },
  { id: "done", label: "Done", tone: "success" },
  { id: "blocked", label: "Blocked", tone: "danger" },
];

export function defaultTableColumns(): Column[] {
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

export function defaultKeyColumns(): KeyColumns {
  return {
    title: "nombre",
    status: "estado",
    owner: "responsable",
    date: "fecha",
  };
}
