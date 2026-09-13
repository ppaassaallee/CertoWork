import { getLocale, t, type Locale } from "../../../lib/i18n";

const PRIORITY_LABELS: Record<string, { en: string; es: string }> = {
  "1": { en: "P1 · Critical", es: "P1 · Crítica" },
  "2": { en: "P2 · High", es: "P2 · Alta" },
  "3": { en: "P3 · Medium", es: "P3 · Media" },
  "4": { en: "P4 · Low", es: "P4 · Baja" },
  "N/A": { en: "No priority", es: "Sin prioridad" },
};

const TYPE_LABELS: Record<string, { en: string; es: string }> = {
  epic: { en: "Epic", es: "Épica" },
  feature: { en: "Feature", es: "Feature" },
  pbi: { en: "PBI", es: "PBI" },
  story: { en: "Story", es: "Historia" },
  task: { en: "Task", es: "Tarea" },
  bug: { en: "Bug", es: "Bug" },
  subtask: { en: "Subtask", es: "Subtarea" },
  ticket: { en: "Ticket", es: "Ticket" },
  issue: { en: "Issue", es: "Issue" },
};

export function itemModalLocale(locale: Locale = getLocale()): Locale {
  return locale;
}

export function typeLabel(kind: string, locale: Locale = getLocale()) {
  const entry = TYPE_LABELS[kind] || TYPE_LABELS.pbi;
  return entry[locale] || entry.en;
}

export function priorityLabel(value: string, locale: Locale = getLocale()) {
  const key = value || "N/A";
  const entry = PRIORITY_LABELS[key] || PRIORITY_LABELS["N/A"];
  return entry[locale] || entry.en;
}

export function statusLabel(status: string, locale: Locale = getLocale()) {
  const map: Record<string, { en: string; es: string }> = {
    backlog: { en: "Backlog", es: "Backlog" },
    ready: { en: "Ready", es: "Listo" },
    todo: { en: "To do", es: "Por hacer" },
    in_progress: { en: "In progress", es: "En progreso" },
    in_review: { en: "In review", es: "En revisión" },
    blocked: { en: "Blocked", es: "Bloqueado" },
    done: { en: "Done", es: "Hecho" },
    cancelled: { en: "Cancelled", es: "Cancelado" },
  };
  const entry = map[status] || { en: status, es: status };
  return entry[locale] || entry.en;
}

export const ITEM_MODAL_COPY = {
  properties: { en: "Properties", es: "Propiedades" },
  classification: { en: "Classification", es: "Clasificación" },
  planning: { en: "My planning", es: "Mi planificación" },
  onlyYou: { en: "only you", es: "solo vos" },
  inherited: { en: "inherited", es: "heredado" },
  inheritedFromProject: { en: "inherited from project", es: "heredado del proyecto" },
  routines: { en: "Routines", es: "Rutinas" },
  activity: { en: "Activity", es: "Actividad" },
  subtasks: { en: "Subtasks", es: "Subtareas" },
  attachments: { en: "Attachments", es: "Adjuntos" },
  comments: { en: "Comments", es: "Comentarios" },
  openCollab: { en: "Open Collab", es: "Abrir Collab" },
  commentPlaceholder: {
    en: "Comment or type @ to ask the team",
    es: "Comentá o escribí @ para preguntarle al equipo",
  },
  bodyPlaceholder: {
    en: "Description, acceptance criteria, notes… / for a block",
    es: "Descripción, criterios de aceptación, notas… / para un bloque",
  },
  structure: { en: "Structure", es: "Estructurar" },
  structureSoon: {
    en: "Structure will use the item compile endpoint when available",
    es: "Estructurar usará el compilador de ítems cuando esté disponible",
  },
  status: { en: "Status", es: "Estado" },
  priority: { en: "Priority", es: "Prioridad" },
  assignee: { en: "Assignee", es: "Asignado" },
  dates: { en: "Dates", es: "Fechas" },
  sprint: { en: "Sprint", es: "Sprint" },
  estimate: { en: "ET", es: "ET" },
  tags: { en: "Tags", es: "Etiquetas" },
  parent: { en: "Parent", es: "Padre" },
  delivery: { en: "Delivery", es: "Entrega" },
  client: { en: "Client", es: "Cliente" },
  category: { en: "Category", es: "Categoría" },
  phase: { en: "Phase", es: "Fase" },
  project: { en: "Project", es: "Proyecto" },
  storyPoints: { en: "Story points", es: "Story points" },
  logged: { en: "Logged (h)", es: "Registrado (h)" },
  repeat: { en: "Repeat", es: "Repetir" },
  gtd: { en: "GTD", es: "GTD" },
  actionBoard: { en: "Action board", es: "Tablero de acción" },
  collaborators: { en: "Collaborators", es: "Colaboradores" },
  deleteItem: { en: "Delete item", es: "Eliminar ítem" },
  more: { en: "More", es: "Más" },
  duplicate: { en: "Duplicate", es: "Duplicar" },
  move: { en: "Move", es: "Mover" },
  convertType: { en: "Convert type", es: "Convertir tipo" },
  copyLink: { en: "Copy link", es: "Copiar link" },
  expand: { en: "Expand", es: "Extender" },
  collapse: { en: "Panel", es: "Panel" },
  addTag: { en: "+ Add", es: "+ Agregar" },
  noSprint: { en: "No sprint", es: "Sin sprint" },
  undefined: { en: "Undefined", es: "Sin definir" },
  thisWeek: { en: "This week", es: "Esta semana" },
} as const;

export function copy(
  key: keyof typeof ITEM_MODAL_COPY,
  locale: Locale = getLocale(),
): string {
  const entry = ITEM_MODAL_COPY[key];
  return entry[locale] || entry.en;
}

/** Keep t() import used for future MessageKey wiring. */
export function itemModalNavHint() {
  return t("navMyWork");
}
