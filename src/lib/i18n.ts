export type Locale = "en" | "es";

const dictionaries = {
  en: {
    navHome: "Home",
    navWork: "Work",
    navApprovals: "Approvals",
    navSettings: "Settings",
    navMore: "More",
    moreAutomations: "Automations",
    moreUpdates: "Updates",
    moreHabits: "Habits",
    moreWorkouts: "Workouts",
    moreWarRoom: "War room",
    moreKnowledge: "Knowledge",
    moreWorkspace: "Workspace & team",
    headerSearch: "Search",
    headerCreate: "Create",
    createTask: "Task",
    createProject: "Project",
    createCapture: "Capture",
    healthOnTrack: "On track",
    healthAtRisk: "At risk",
    healthBlocked: "Blocked",
    emptyHome: "Nothing needs attention right now.",
    emptyWork: "Create a project to start tracking delivery.",
    emptyApprovals: "No pending approvals.",
    emptySettings: "Workspace preferences and integrations live here.",
    signOut: "Sign out",
    expandNav: "Expand navigation",
    collapseNav: "Collapse navigation",
    openNav: "Open navigation",
    closeNav: "Close navigation",
    odiseusName: "Odiseus",
    odiseusTagline: "Not a tool. A hire.",
    odiseusSubline:
      "The AI employee that lives inside Certo Work. You set direction; Odiseus does the legwork and asks before anything irreversible.",
    odiseusSidebarBlurb: "Does the work you can't get to",
    odiseusWelcomePrompt: "What should Odiseus take ownership of?",
    odiseusFocusedPrompt: "What should move next on this work?",
  },
  es: {
    navHome: "Inicio",
    navWork: "Trabajo",
    navApprovals: "Aprobaciones",
    navSettings: "Ajustes",
    navMore: "Más",
    moreAutomations: "Automatizaciones",
    moreUpdates: "Actualizaciones",
    moreHabits: "Hábitos",
    moreWorkouts: "Entrenamientos",
    moreWarRoom: "Sala de guerra",
    moreKnowledge: "Conocimiento",
    moreWorkspace: "Espacio y equipo",
    headerSearch: "Buscar",
    headerCreate: "Crear",
    createTask: "Tarea",
    createProject: "Proyecto",
    createCapture: "Captura",
    healthOnTrack: "En curso",
    healthAtRisk: "En riesgo",
    healthBlocked: "Bloqueado",
    emptyHome: "Nada requiere tu atención ahora.",
    emptyWork: "Crea un proyecto para empezar a seguir la entrega.",
    emptyApprovals: "No hay aprobaciones pendientes.",
    emptySettings: "Aquí viven las preferencias e integraciones del espacio.",
    signOut: "Cerrar sesión",
    expandNav: "Expandir navegación",
    collapseNav: "Contraer navegación",
    openNav: "Abrir navegación",
    closeNav: "Cerrar navegación",
    odiseusName: "Odiseus",
    odiseusTagline: "No es una herramienta. Es una contratación.",
    odiseusSubline:
      "El empleado de IA que vive dentro de Certo Work. Tú das dirección; Odiseus hace el trabajo y pregunta antes de lo irreversible.",
    odiseusSidebarBlurb: "Hace el trabajo al que no llegas",
    odiseusWelcomePrompt: "¿De qué debería hacerse cargo Odiseus?",
    odiseusFocusedPrompt: "¿Qué debe avanzar en este trabajo?",
  },
} as const;

export type MessageKey = keyof typeof dictionaries.en;

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

let currentLocale: Locale = detectLocale();

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale() {
  return currentLocale;
}

export function t(key: MessageKey, locale: Locale = currentLocale) {
  return dictionaries[locale][key] || dictionaries.en[key];
}

export const i18n = dictionaries;
