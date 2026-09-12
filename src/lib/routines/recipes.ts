import type { RoutineEntityType, RoutineRecipe } from "./types";

/** Curated Phase-1 recipes (project + portfolio). */
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
    entityTypes: ["project"],
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
];

export function recipesForEntity(entityType: RoutineEntityType): RoutineRecipe[] {
  return ROUTINE_RECIPES.filter((recipe) => recipe.entityTypes.includes(entityType));
}

export const COMPOSER_PLACEHOLDERS = [
  "Cada viernes resumime esta épica para el cliente",
  "Avisame por correo si esto se bloquea",
  "Cada 3 días revisá si hay ítems sin dueño y proponé asignarlos",
  "Cada mañana de lunes a viernes a las 7 dame el brief de este proyecto",
];
