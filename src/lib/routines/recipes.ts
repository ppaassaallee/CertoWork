import type { RoutineEntityType, RoutineRecipe } from "./types";

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
];

export function recipesForEntity(entityType: RoutineEntityType): RoutineRecipe[] {
  return ROUTINE_RECIPES.filter((recipe) => recipe.entityTypes.includes(entityType));
}

export const COMPOSER_PLACEHOLDERS = [
  "Cada viernes resumime esta épica para el cliente",
  "Avisame por correo si esto se bloquea",
  "Cada 3 días revisá si hay ítems sin dueño y proponé asignarlos",
  "Cada mañana de lunes a viernes a las 7 dame el brief de este proyecto",
  "Cuando se cree una nota de reunión, actualizá el estado de los ítems mencionados",
  "Si esta request no tiene respuesta en 48 h, recordá al asignado",
];
