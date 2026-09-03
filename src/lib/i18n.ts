export type Locale = "en" | "es";

const dictionaries = {
  en: {
    navHome: "Home",
    navMyWork: "My Work",
    navProjects: "Projects",
    navNotes: "Notes",
    navAgents: "Agents",
    navWork: "Projects",
    navApprovals: "Approvals",
    navInvoices: "Invoices",
    navSettings: "Settings",
    productSwitcher: "Certo products",
    productWork: "Certo Work",
    productCollab: "Chat Collab",
    productBackToWork: "Back to work",
    navMore: "More",
    navWorkspace: "Workspace & team",
    navHelp: "Help",
    navFeedback: "SupportOps",
    createBug: "Report bug",
    createFeature: "Request feature",
    emptyFeedback: "Open SupportOps to report a bug or request a feature.",
    myWorkAssigned: "Assigned to me",
    myWorkInbox: "Inbox",
    myWorkWaiting: "Waiting",
    myWorkToday: "Today",
    myWorkThisWeek: "This week",
    agentsOdysseus: "Odysseus",
    agentsAutomations: "Automations",
    agentsActivity: "Activity",
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
    createMagicProject: "Magic project",
    createCapture: "Capture",
    healthOnTrack: "On track",
    healthAtRisk: "At risk",
    healthBlocked: "Blocked",
    emptyHome: "Nothing needs attention right now.",
    emptyWork: "Create a project to start tracking delivery.",
    emptyMyWork: "Nothing assigned to you right now.",
    emptyApprovals: "No pending approvals.",
    emptyInvoices: "Push a pending invoice or open the client portal.",
    emptySettings: "Workspace preferences and integrations live here.",
    emptyAgents: "Ask Odysseus to take work off your plate.",
    signOut: "Sign out",
    expandNav: "Expand navigation",
    collapseNav: "Collapse navigation",
    openNav: "Open navigation",
    closeNav: "Close navigation",
    odiseusName: "Odysseus",
    odiseusTagline: "Not a tool. A hire.",
    odiseusSubline:
      "Assign an outcome. Odysseus can investigate, organize, execute and return the finished work.",
    odiseusSidebarBlurb: "Does the work you can't get to",
    odiseusWelcomePrompt: "What should I take off your plate?",
    odiseusFocusedPrompt: "What should move next on this work?",
  },
  es: {
    navHome: "Inicio",
    navMyWork: "Mi trabajo",
    navProjects: "Proyectos",
    navNotes: "Notas",
    navAgents: "Agentes",
    navWork: "Proyectos",
    navApprovals: "Aprobaciones",
    navInvoices: "Facturas",
    navSettings: "Ajustes",
    productSwitcher: "Productos Certo",
    productWork: "Certo Work",
    productCollab: "Chat Collab",
    productBackToWork: "Volver al trabajo",
    navMore: "Más",
    navWorkspace: "Espacio y equipo",
    navHelp: "Ayuda",
    navFeedback: "SupportOps",
    createBug: "Reportar error",
    createFeature: "Pedir función",
    emptyFeedback: "Abre SupportOps para reportar un error o pedir una función.",
    myWorkAssigned: "Asignado a mí",
    myWorkInbox: "Bandeja",
    myWorkWaiting: "En espera",
    myWorkToday: "Hoy",
    myWorkThisWeek: "Esta semana",
    agentsOdysseus: "Odysseus",
    agentsAutomations: "Automatizaciones",
    agentsActivity: "Actividad",
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
    createMagicProject: "Proyecto mágico",
    createCapture: "Captura",
    healthOnTrack: "En curso",
    healthAtRisk: "En riesgo",
    healthBlocked: "Bloqueado",
    emptyHome: "Nada requiere tu atención ahora.",
    emptyWork: "Crea un proyecto para empezar a seguir la entrega.",
    emptyMyWork: "Nada asignado a ti ahora.",
    emptyApprovals: "No hay aprobaciones pendientes.",
    emptyInvoices: "Empuja una factura pendiente o abre el portal del cliente.",
    emptySettings: "Aquí viven las preferencias e integraciones del espacio.",
    emptyAgents: "Pide a Odysseus que te quite trabajo de encima.",
    signOut: "Cerrar sesión",
    expandNav: "Expandir navegación",
    collapseNav: "Contraer navegación",
    openNav: "Abrir navegación",
    closeNav: "Cerrar navegación",
    odiseusName: "Odysseus",
    odiseusTagline: "No es una herramienta. Es una contratación.",
    odiseusSubline:
      "Asigna un resultado. Odysseus puede investigar, organizar, ejecutar y devolver el trabajo terminado.",
    odiseusSidebarBlurb: "Hace el trabajo al que no llegas",
    odiseusWelcomePrompt: "¿Qué te quito de encima?",
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
