import type { RoutineEntityType, RoutineRecipe } from "./types";
import type { Locale } from "../i18n";

/** Curated recipes — project, portfolio, task, note, request, invoice. */
export const ROUTINE_RECIPES: RoutineRecipe[] = [
  {
    id: "brief-matutino",
    title: "Brief matutino",
    sentence: "Cada mañana de lunes a viernes a las 7 resumime este proyecto para mí por correo",
    entityTypes: ["project", "portfolio"],
    triggerHint: "Lun–Vie 07:00",
    deliverableHint: "Correo al dueño",
  },
  {
    id: "vigia-fechas",
    title: "Vigía de fechas",
    sentence: "Cada día a las 8 avisame por comentario y correo si hay ítems que vencen en 3 días o atrasados",
    entityTypes: ["project"],
    triggerHint: "Diario 08:00",
    deliverableHint: "Comentario + correo",
  },
  {
    id: "cazador-bloqueos",
    title: "Cazador de bloqueos",
    sentence: "Cuando un ítem se bloquee, avisame por correo con el motivo y una sugerencia de desbloqueo",
    entityTypes: ["project", "task"],
    triggerHint: "Cuando se bloquee",
    deliverableHint: "Correo al dueño",
  },
  {
    id: "resumen-cliente",
    title: "Resumen semanal al cliente",
    sentence: "Cada viernes a las 16 prepará un borrador de correo al cliente con el avance de la semana para que yo lo apruebe",
    entityTypes: ["project"],
    triggerHint: "Vie 16:00",
    deliverableHint: "Borrador (pide aprobación)",
  },
  {
    id: "pulso-portafolio",
    title: "Pulso del portafolio",
    sentence: "Cada lunes a las 7:30 enviame un correo con proyectos at risk, blocked y próximos checkpoints",
    entityTypes: ["portfolio"],
    triggerHint: "Lun 07:30",
    deliverableHint: "Correo al dueño",
  },
  {
    id: "higiene-backlog",
    title: "Higiene del backlog",
    sentence: "Cada 3 días proponé dueño, estimación y tipo a ítems incompletos y pedime aprobación antes de aplicar",
    entityTypes: ["project"],
    triggerHint: "Cada 3 días",
    deliverableHint: "Propuestas (pide aprobación)",
  },
  {
    id: "preparar-sprint",
    title: "Preparar el sprint",
    sentence: "Cada 2 semanas el lunes proponé en una nota qué entra al sprint, qué no, y los riesgos",
    entityTypes: ["project"],
    triggerHint: "Cada 2 semanas",
    deliverableHint: "Nota con propuesta",
  },
  {
    id: "item-pulse",
    title: "Pulso del ítem",
    sentence: "Cada mañana avisame por comentario si este ítem está bloqueado o vencido y sugerí el siguiente paso",
    entityTypes: ["task"],
    triggerHint: "Diario",
    deliverableHint: "Comentario en el ítem",
  },
  {
    id: "item-due-watch",
    title: "Vigía de este ítem",
    sentence: "Cuando este ítem se acerque a su fecha o se bloquee, avisame por correo",
    entityTypes: ["task"],
    triggerHint: "Evento",
    deliverableHint: "Correo al dueño",
  },
  {
    id: "nota-a-estado",
    title: "Estado desde las notas",
    sentence: "Cuando se cree una nota de reunión, proponé actualizar estado y progreso de los ítems mencionados y pedime aprobación",
    entityTypes: ["note", "project"],
    triggerHint: "Cuando se cree una nota",
    deliverableHint: "Actualizar ítems (pide aprobación)",
  },
  {
    id: "seguimiento-request",
    title: "Seguimiento de request",
    sentence: "Si esta request lleva 48 h sin respuesta, recordá al asignado por comentario; a las 96 h escalá al owner por correo",
    entityTypes: ["request"],
    triggerHint: "48 h / 96 h",
    deliverableHint: "Comentario + correo",
  },
  {
    id: "cobranza-factura",
    title: "Cobranza de factura",
    sentence: "Al vencer más 3 días prepará un borrador de recordatorio al cliente para que yo lo apruebe",
    entityTypes: ["invoice"],
    triggerHint: "Vencida +3 d",
    deliverableHint: "Borrador (pide aprobación)",
  },
  {
    id: "wrap-review",
    title: "WRAP Review",
    sentence: "Cada viernes a las 4 guiame por mi revisión de la semana.",
    entityTypes: ["person", "portfolio"],
    triggerHint: "Vie 16:00",
    deliverableHint: "Sesión guiada · ~12 min",
    domain: "personal",
    estimatedMinutes: 12,
    class: "guided",
  },
  {
    id: "weekly-plan",
    title: "Plan semanal",
    sentence:
      "Cada lunes a las 8 ayudame a planear la semana con 2 o 3 metas y tiempo protegido.",
    entityTypes: ["person", "portfolio"],
    triggerHint: "Lun 08:00",
    deliverableHint: "Sesión guiada · ~7 min",
    domain: "personal",
    estimatedMinutes: 7,
    class: "guided",
  },
  {
    id: "close-day",
    title: "Cerrar el día",
    sentence: "Cada día laboral a las 6 ayudame a cerrar el día en un minuto",
    entityTypes: ["person"],
    triggerHint: "Lun–Vie 18:00",
    deliverableHint: "Nota diaria + score",
    domain: "personal",
    estimatedMinutes: 2,
    class: "guided",
  },
];

const englishRecipeCopy: Record<string, Pick<RoutineRecipe, "title" | "sentence" | "triggerHint" | "deliverableHint">> = {
  "brief-matutino": { title: "Morning brief", sentence: "Summarize this project by email every weekday at 7 am.", triggerHint: "Mon–Fri 07:00", deliverableHint: "Email to owner" },
  "vigia-fechas": { title: "Due date watch", sentence: "Every day at 8 am, alert me about items due within three days or overdue.", triggerHint: "Daily 08:00", deliverableHint: "Comment and email" },
  "cazador-bloqueos": { title: "Blocker watch", sentence: "When an item becomes blocked, email me the reason and a suggested next step.", triggerHint: "When blocked", deliverableHint: "Email to owner" },
  "resumen-cliente": { title: "Weekly client update", sentence: "Every Friday at 4 pm, draft a client update for my approval.", triggerHint: "Fri 16:00", deliverableHint: "Draft for approval" },
  "pulso-portafolio": { title: "Portfolio pulse", sentence: "Every Monday at 7:30 am, email me projects at risk, blocked projects and upcoming checkpoints.", triggerHint: "Mon 07:30", deliverableHint: "Email to owner" },
  "higiene-backlog": { title: "Backlog cleanup", sentence: "Every three days, propose owners, estimates and types for incomplete items before applying changes.", triggerHint: "Every 3 days", deliverableHint: "Proposals for approval" },
  "preparar-sprint": { title: "Prepare the sprint", sentence: "Every other Monday, suggest sprint scope and risks in a note.", triggerHint: "Every 2 weeks", deliverableHint: "Proposal note" },
  "item-pulse": { title: "Item pulse", sentence: "Each morning, comment when this item is blocked or overdue and suggest the next step.", triggerHint: "Daily", deliverableHint: "Item comment" },
  "item-due-watch": { title: "Item due date watch", sentence: "Email me when this item nears its due date or becomes blocked.", triggerHint: "On event", deliverableHint: "Email to owner" },
  "nota-a-estado": { title: "Notes to status", sentence: "When meeting notes are created, propose status and progress updates for mentioned items.", triggerHint: "When notes are created", deliverableHint: "Updates for approval" },
  "seguimiento-request": { title: "Request follow-up", sentence: "After 48 hours without a reply, remind the assignee; after 96 hours, email the owner.", triggerHint: "48 h / 96 h", deliverableHint: "Comment and email" },
  "cobranza-factura": { title: "Invoice follow-up", sentence: "Three days after an invoice is due, draft a client reminder for my approval.", triggerHint: "3 days overdue", deliverableHint: "Draft for approval" },
  "wrap-review": { title: "WRAP Review", sentence: "Guide my weekly review every Friday at 4 pm.", triggerHint: "Fri 16:00", deliverableHint: "Guided session · ~12 min" },
  "weekly-plan": { title: "Weekly plan", sentence: "Every Monday at 8 am, help me plan two or three goals and protect time for them.", triggerHint: "Mon 08:00", deliverableHint: "Guided session · ~7 min" },
  "close-day": { title: "Close the day", sentence: "Help me close each workday in one minute at 6 pm.", triggerHint: "Mon–Fri 18:00", deliverableHint: "Daily note and score" },
};

export function localizedRoutineRecipe(recipe: RoutineRecipe, locale: Locale): RoutineRecipe {
  return locale === "en" ? { ...recipe, ...englishRecipeCopy[recipe.id] } : recipe;
}

export function recipesForEntity(entityType: RoutineEntityType): RoutineRecipe[] {
  return ROUTINE_RECIPES.filter((recipe) => recipe.entityTypes.includes(entityType));
}

export function recipesForDomain(
  domain: "personal" | "project" | "portfolio" | "all" = "all",
): RoutineRecipe[] {
  if (domain === "all") return ROUTINE_RECIPES;
  return ROUTINE_RECIPES.filter((recipe) => (recipe.domain || "project") === domain);
}

export const COMPOSER_PLACEHOLDERS = [
  "Cada viernes resumime esta épica para el cliente",
  "Avisame por correo si esto se bloquea",
  "Cada 3 días revisá si hay ítems sin dueño y proponé asignarlos",
  "Cada mañana de lunes a viernes a las 7 dame el brief de este proyecto",
  "Cuando se cree una nota de reunión, actualizá el estado de los ítems mencionados",
  "Si esta request no tiene respuesta en 48 h, recordá al asignado",
];
