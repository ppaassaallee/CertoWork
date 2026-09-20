export const briefStrings = {
  en: {
    listen: "Listen to your brief",
    refresh: "Refresh brief",
    prepare: "Prepare",
    worthNoting: "Worth noting",
    yourSchedule: "Your schedule",
    thisWeek: "This week",
    upcoming: "Upcoming meetings",
  },
  es: {
    listen: "Escucha tu brief",
    refresh: "Actualizar brief",
    prepare: "Preparar",
    worthNoting: "Vale la pena notar",
    yourSchedule: "Tu agenda",
    thisWeek: "Esta semana",
    upcoming: "Próximas reuniones",
  },
} as const;

export const billingStrings = {
  en: {
    outstanding: "outstanding across",
    invoices: "invoices",
    sendReminder: "Send reminder",
    markPaid: "Mark as paid",
    export: "Export",
  },
  es: {
    outstanding: "pendiente en",
    invoices: "facturas",
    sendReminder: "Enviar recordatorio",
    markPaid: "Marcar como pagada",
    export: "Exportar",
  },
} as const;

export function pickLang(lang?: string): "en" | "es" {
  return lang?.toLowerCase().startsWith("es") ? "es" : "en";
}
