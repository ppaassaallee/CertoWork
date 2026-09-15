import type { Column, KeyColumns, StatusOption } from "./types";

export type TableTemplateId =
  | "pipeline"
  | "vendors"
  | "onboarding"
  | "risks"
  | "requests"
  | "clients"
  | "access"
  | "okrs";

export type SuggestedAutomationTrigger =
  | {
      kind: "status_changed";
      statusTo: string;
    }
  | {
      kind: "record_created";
    }
  | {
      kind: "date_reached";
      offsetDays: number;
    }
  | {
      kind: "schedule";
      cron: string;
      human: string;
    };

export type SuggestedAutomation = {
  sentenceEs: string;
  sentenceEn: string;
  trigger: SuggestedAutomationTrigger;
};

export type TableTemplate = {
  id: TableTemplateId;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  icon: string;
  color: string;
  columns: Column[];
  keyColumns: KeyColumns;
  suggestedAutomation: SuggestedAutomation;
};

function status(
  id: string,
  label: string,
  tone: StatusOption["tone"],
): StatusOption {
  return { id, label, tone };
}

function col(
  partial: Omit<Column, "width"> & { width?: number },
): Column {
  return { width: 140, ...partial };
}

export const TABLE_TEMPLATES: TableTemplate[] = [
  {
    id: "pipeline",
    nameEs: "Pipeline comercial",
    nameEn: "Sales pipeline",
    descriptionEs: "Oportunidades, etapas y cierre.",
    descriptionEn: "Opportunities, stages, and close.",
    icon: "◇",
    color: "#0F766E",
    columns: [
      col({ id: "nombre", name: "Oportunidad", type: "text", required: true, width: 220 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        width: 140,
        options: [
          status("prospecto", "Prospecto", "neutral"),
          status("calificado", "Calificado", "info"),
          status("propuesta", "Propuesta", "purple"),
          status("negociacion", "Negociación", "warning"),
          status("ganado", "Ganado", "success"),
          status("perdido", "Perdido", "danger"),
        ],
      }),
      col({ id: "responsable", name: "Responsable", type: "person", width: 160 }),
      col({ id: "monto", name: "Monto", type: "currency", currency: "USD", width: 120 }),
      col({ id: "cierre", name: "Cierre", type: "date", width: 130 }),
      col({ id: "cliente", name: "Cliente", type: "text", width: 160 }),
    ],
    keyColumns: {
      title: "nombre",
      status: "estado",
      owner: "responsable",
      date: "cierre",
    },
    suggestedAutomation: {
      sentenceEs:
        "Cuando el estado → Ganado, crear proyecto y nota de kickoff",
      sentenceEn:
        "When status → Won, create project and kickoff note",
      trigger: { kind: "status_changed", statusTo: "ganado" },
    },
  },
  {
    id: "vendors",
    nameEs: "Proveedores y suscripciones",
    nameEn: "Vendors & subscriptions",
    descriptionEs: "Renovaciones, costos y dueños.",
    descriptionEn: "Renewals, costs, and owners.",
    icon: "▣",
    color: "#B45309",
    columns: [
      col({ id: "nombre", name: "Proveedor", type: "text", required: true, width: 200 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("activo", "Activo", "success"),
          status("por_renovar", "Por renovar", "warning"),
          status("cancelado", "Cancelado", "danger"),
          status("evaluando", "Evaluando", "info"),
        ],
      }),
      col({ id: "responsable", name: "Responsable", type: "person", width: 160 }),
      col({ id: "renovacion", name: "Renovación", type: "date", width: 130 }),
      col({ id: "monto", name: "Monto", type: "currency", currency: "USD", width: 120 }),
      col({ id: "ciclo", name: "Ciclo", type: "tags", tagOptions: ["mensual", "anual", "único"], width: 120 }),
      col({ id: "url", name: "URL", type: "url", width: 160 }),
    ],
    keyColumns: {
      title: "nombre",
      status: "estado",
      owner: "responsable",
      date: "renovacion",
    },
    suggestedAutomation: {
      sentenceEs:
        "15 días antes de renovación, crear nota e ítem de revisión",
      sentenceEn:
        "15 days before renewal, create note and review item",
      trigger: { kind: "date_reached", offsetDays: 15 },
    },
  },
  {
    id: "onboarding",
    nameEs: "Onboarding de personas",
    nameEn: "People onboarding",
    descriptionEs: "Altas, roles y checklist.",
    descriptionEn: "Hires, roles, and checklist.",
    icon: "◎",
    color: "#1D4ED8",
    columns: [
      col({ id: "nombre", name: "Persona", type: "text", required: true, width: 200 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("pendiente", "Pendiente", "neutral"),
          status("en_curso", "En curso", "info"),
          status("listo", "Listo", "success"),
          status("bloqueado", "Bloqueado", "danger"),
        ],
      }),
      col({ id: "responsable", name: "Buddy", type: "person", width: 160 }),
      col({ id: "inicio", name: "Fecha inicio", type: "date", width: 130 }),
      col({ id: "rol", name: "Rol", type: "text", width: 140 }),
      col({ id: "equipo", name: "Equipo", type: "text", width: 140 }),
      col({ id: "email", name: "Email", type: "email", width: 180 }),
    ],
    keyColumns: {
      title: "nombre",
      status: "estado",
      owner: "responsable",
      date: "inicio",
    },
    suggestedAutomation: {
      sentenceEs:
        "Cuando se cree un registro, crear 6 ítems de onboarding",
      sentenceEn:
        "When a record is created, create 6 onboarding items",
      trigger: { kind: "record_created" },
    },
  },
  {
    id: "risks",
    nameEs: "Riesgos del portafolio",
    nameEn: "Portfolio risks",
    descriptionEs: "Severidad, dueño y revisión.",
    descriptionEn: "Severity, owner, and review.",
    icon: "⚠",
    color: "#B91C1C",
    columns: [
      col({ id: "nombre", name: "Riesgo", type: "text", required: true, width: 220 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("abierto", "Abierto", "warning"),
          status("mitigando", "Mitigando", "info"),
          status("aceptado", "Aceptado", "purple"),
          status("cerrado", "Cerrado", "success"),
        ],
      }),
      col({ id: "responsable", name: "Dueño", type: "person", width: 160 }),
      col({ id: "revision", name: "Revisión", type: "date", width: 130 }),
      col({
        id: "severidad",
        name: "Severidad",
        type: "status",
        width: 120,
        options: [
          status("baja", "Baja", "neutral"),
          status("media", "Media", "warning"),
          status("alta", "Alta", "danger"),
          status("critica", "Crítica", "danger"),
        ],
      }),
      col({ id: "proyecto", name: "Proyecto", type: "text", width: 160 }),
      col({ id: "notas", name: "Notas", type: "longtext", width: 200 }),
    ],
    keyColumns: {
      title: "nombre",
      status: "estado",
      owner: "responsable",
      date: "revision",
    },
    suggestedAutomation: {
      sentenceEs:
        "Cuando la revisión esté vencida, notificar al dueño",
      sentenceEn:
        "When review is overdue, notify the owner",
      trigger: { kind: "date_reached", offsetDays: 0 },
    },
  },
  {
    id: "requests",
    nameEs: "Pedidos internos",
    nameEn: "Internal requests",
    descriptionEs: "Solicitudes del equipo y prioridad.",
    descriptionEn: "Team asks and priority.",
    icon: "▸",
    color: "#7C3AED",
    columns: [
      col({ id: "nombre", name: "Pedido", type: "text", required: true, width: 220 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("nuevo", "Nuevo", "info"),
          status("en_curso", "En curso", "purple"),
          status("esperando", "Esperando", "warning"),
          status("resuelto", "Resuelto", "success"),
          status("rechazado", "Rechazado", "danger"),
        ],
      }),
      col({ id: "responsable", name: "Responsable", type: "person", width: 160 }),
      col({ id: "fecha", name: "Necesario para", type: "date", width: 130 }),
      col({ id: "solicitante", name: "Solicitante", type: "person", width: 160 }),
      col({
        id: "prioridad",
        name: "Prioridad",
        type: "status",
        width: 120,
        options: [
          status("baja", "Baja", "neutral"),
          status("media", "Media", "info"),
          status("alta", "Alta", "warning"),
          status("urgente", "Urgente", "danger"),
        ],
      }),
      col({ id: "detalle", name: "Detalle", type: "longtext", width: 200 }),
    ],
    keyColumns: {
      title: "nombre",
      status: "estado",
      owner: "responsable",
      date: "fecha",
    },
    suggestedAutomation: {
      sentenceEs:
        "Cuando se cree un registro, crear ticket de soporte",
      sentenceEn:
        "When a record is created, create a support ticket",
      trigger: { kind: "record_created" },
    },
  },
  {
    id: "clients",
    nameEs: "Clientes y contactos",
    nameEn: "Clients & contacts",
    descriptionEs: "Relación, último contacto y siguiente paso.",
    descriptionEn: "Relationship, last touch, next step.",
    icon: "◉",
    color: "#0E7490",
    columns: [
      col({ id: "nombre", name: "Cliente", type: "text", required: true, width: 200 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("activo", "Activo", "success"),
          status("prospecto", "Prospecto", "info"),
          status("en_riesgo", "En riesgo", "warning"),
          status("churn", "Churn", "danger"),
        ],
      }),
      col({ id: "responsable", name: "Account", type: "person", width: 160 }),
      col({ id: "ultimo_contacto", name: "Último contacto", type: "date", width: 140 }),
      col({ id: "empresa", name: "Empresa", type: "text", width: 160 }),
      col({ id: "email", name: "Email", type: "email", width: 180 }),
      col({ id: "telefono", name: "Teléfono", type: "phone", width: 140 }),
      col({ id: "siguiente", name: "Siguiente paso", type: "text", width: 180 }),
    ],
    keyColumns: {
      title: "nombre",
      status: "estado",
      owner: "responsable",
      date: "ultimo_contacto",
    },
    suggestedAutomation: {
      sentenceEs:
        "30 días sin contacto, crear ítem de follow-up",
      sentenceEn:
        "30 days without contact, create a follow-up item",
      // Treat as reminder on the contact date horizon (30d after last touch → schedule the date column + offset).
      trigger: { kind: "date_reached", offsetDays: 0 },
    },
  },
  {
    id: "access",
    nameEs: "Inventario de accesos",
    nameEn: "Access inventory",
    descriptionEs: "Sistemas, vencimiento y revisión.",
    descriptionEn: "Systems, expiry, and review.",
    icon: "⬡",
    color: "#4338CA",
    columns: [
      col({ id: "nombre", name: "Sistema", type: "text", required: true, width: 180 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("activo", "Activo", "success"),
          status("revisar", "Revisar", "warning"),
          status("revocado", "Revocado", "danger"),
          status("pendiente", "Pendiente", "neutral"),
        ],
      }),
      col({ id: "responsable", name: "Responsable", type: "person", width: 160 }),
      col({ id: "vence", name: "Vence", type: "date", width: 130 }),
      col({ id: "persona", name: "Persona", type: "person", width: 160 }),
      col({ id: "nivel", name: "Nivel", type: "tags", tagOptions: ["lectura", "escritura", "admin"], width: 120 }),
      col({ id: "notas", name: "Notas", type: "longtext", width: 180 }),
    ],
    keyColumns: {
      title: "nombre",
      status: "estado",
      owner: "responsable",
      date: "vence",
    },
    suggestedAutomation: {
      sentenceEs:
        "Cuando venza el acceso, poner Revisar y notificar",
      sentenceEn:
        "When access expires, set Review and notify",
      trigger: { kind: "date_reached", offsetDays: 0 },
    },
  },
  {
    id: "okrs",
    nameEs: "OKRs del trimestre",
    nameEn: "Quarterly OKRs",
    descriptionEs: "Objetivos, progreso y dueño.",
    descriptionEn: "Objectives, progress, and owner.",
    icon: "✦",
    color: "#047857",
    columns: [
      col({ id: "nombre", name: "Objetivo", type: "text", required: true, width: 220 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("on_track", "En curso", "success"),
          status("at_risk", "En riesgo", "warning"),
          status("behind", "Atrasado", "danger"),
          status("done", "Logrado", "info"),
        ],
      }),
      col({ id: "responsable", name: "Dueño", type: "person", width: 160 }),
      col({ id: "fecha", name: "Deadline", type: "date", width: 130 }),
      col({ id: "progreso", name: "Progreso %", type: "number", width: 110 }),
      col({ id: "kr", name: "Key result", type: "longtext", width: 220 }),
      col({ id: "equipo", name: "Equipo", type: "text", width: 140 }),
    ],
    keyColumns: {
      title: "nombre",
      status: "estado",
      owner: "responsable",
      date: "fecha",
    },
    suggestedAutomation: {
      sentenceEs:
        "Cada viernes, pedir a Odysseus un resumen de OKRs",
      sentenceEn:
        "Every Friday, ask Odysseus to summarize OKRs",
      trigger: {
        kind: "schedule",
        cron: "0 9 * * 5",
        human: "Viernes 09:00",
      },
    },
  },
];

export function getTableTemplate(id: string): TableTemplate | undefined {
  return TABLE_TEMPLATES.find((tpl) => tpl.id === id);
}

export function templateDisplayName(
  template: TableTemplate,
  locale: "es" | "en",
): string {
  return locale === "en" ? template.nameEn : template.nameEs;
}

export function templateDescription(
  template: TableTemplate,
  locale: "es" | "en",
): string {
  return locale === "en" ? template.descriptionEn : template.descriptionEs;
}

export function templateAutomationSentence(
  template: TableTemplate,
  locale: "es" | "en",
): string {
  return locale === "en"
    ? template.suggestedAutomation.sentenceEn
    : template.suggestedAutomation.sentenceEs;
}
