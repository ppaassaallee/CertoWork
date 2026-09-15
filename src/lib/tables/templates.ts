import type { Column, KeyColumns, RecordValue, StatusOption } from "./types";

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

export type TemplateSampleRow = Record<string, string>;

export type TableTemplate = {
  id: TableTemplateId;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  /** Short one-line description for card (es). */
  shortEs: string;
  /** Short one-line description for card (en). */
  shortEn: string;
  /** Lucide icon name used in the create modal. */
  iconName: string;
  icon: string;
  color: string;
  iconBg: string;
  iconFg: string;
  columns: Column[];
  keyColumns: KeyColumns;
  suggestedAutomation: SuggestedAutomation;
  /** ≤6 word automation hint for card footer. */
  autoHintEs: string;
  autoHintEn: string;
  /** Two rows for mini cards; preview may show up to three. */
  sampleRows: TemplateSampleRow[];
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
    shortEs: "Oportunidades y cierre",
    shortEn: "Deals and close",
    iconName: "TrendingUp",
    icon: "◇",
    color: "#0C447C",
    iconBg: "#E6F1FB",
    iconFg: "#0C447C",
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
          status("propuesta", "Propuesta", "warning"),
          status("negociacion", "Negociación", "purple"),
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
    autoHintEs: "Ganado → proyecto + kickoff",
    autoHintEn: "Won → project + kickoff",
    sampleRows: [
      {
        nombre: "Acquaroni",
        estado: "propuesta",
        responsable: "R.",
        monto: "$18k",
        cierre: "Oct 12",
        cliente: "Acquaroni",
      },
      {
        nombre: "KruOps",
        estado: "ganado",
        responsable: "A.",
        monto: "$40k",
        cierre: "Sep 28",
        cliente: "KruOps",
      },
      {
        nombre: "CHAMAN",
        estado: "negociacion",
        responsable: "E.",
        monto: "$12k",
        cierre: "Nov 3",
        cliente: "CHAMAN",
      },
    ],
  },
  {
    id: "vendors",
    nameEs: "Proveedores",
    nameEn: "Vendors",
    descriptionEs: "Renovaciones, costos y dueños.",
    descriptionEn: "Renewals, costs, and owners.",
    shortEs: "Renovaciones y costos",
    shortEn: "Renewals and costs",
    iconName: "Building2",
    icon: "▣",
    color: "#3C3489",
    iconBg: "#EEEDFE",
    iconFg: "#3C3489",
    columns: [
      col({ id: "nombre", name: "Proveedor", type: "text", required: true, width: 200 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("evaluando", "Evaluando", "neutral"),
          status("activo", "Activo", "success"),
          status("en_revision", "En revisión", "warning"),
          status("vencido", "Vencido", "danger"),
          status("cancelado", "Cancelado", "neutral"),
        ],
      }),
      col({ id: "responsable", name: "Responsable", type: "person", width: 160 }),
      col({ id: "renovacion", name: "Renueva", type: "date", width: 130 }),
      col({ id: "monto", name: "Monto/mes", type: "currency", currency: "USD", width: 120 }),
      col({ id: "contrato", name: "Contrato", type: "file", width: 140 }),
    ],
    keyColumns: {
      title: "nombre",
      status: "estado",
      owner: "responsable",
      date: "renovacion",
    },
    suggestedAutomation: {
      sentenceEs:
        "15 días antes de Renueva: Odysseus prepara una nota de renegociación y crea un ítem para el responsable",
      sentenceEn:
        "15 days before Renews: Odysseus prepares a renegotiation note and creates an item for the owner",
      trigger: { kind: "date_reached", offsetDays: 15 },
    },
    autoHintEs: "15 d antes → renegociar",
    autoHintEn: "15 d before → renegotiate",
    sampleRows: [
      {
        nombre: "Brevo",
        estado: "en_revision",
        responsable: "Regina",
        renovacion: "Sep 30",
        monto: "$180",
        contrato: "PDF",
      },
      {
        nombre: "Cloudflare",
        estado: "activo",
        responsable: "Edgar",
        renovacion: "Dic 1",
        monto: "$240",
        contrato: "PDF",
      },
      {
        nombre: "Chatwoot",
        estado: "vencido",
        responsable: "César",
        renovacion: "Sep 10",
        monto: "$99",
        contrato: "—",
      },
    ],
  },
  {
    id: "onboarding",
    nameEs: "Onboarding",
    nameEn: "Onboarding",
    descriptionEs: "Altas, roles y checklist.",
    descriptionEn: "Hires, roles, and checklist.",
    shortEs: "Ingresos y checklist",
    shortEn: "Hires and checklist",
    iconName: "UserPlus",
    icon: "◎",
    color: "#3B6D11",
    iconBg: "#E1F5C4",
    iconFg: "#3B6D11",
    columns: [
      col({ id: "nombre", name: "Persona", type: "text", required: true, width: 200 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("pendiente", "Pendiente", "neutral"),
          status("semana_1", "Semana 1", "info"),
          status("en_curso", "En curso", "info"),
          status("listo", "Listo", "success"),
          status("bloqueado", "Bloqueado", "danger"),
        ],
      }),
      col({ id: "responsable", name: "Buddy", type: "person", width: 160 }),
      col({ id: "inicio", name: "Inicio", type: "date", width: 130 }),
      col({ id: "rol", name: "Rol", type: "text", width: 140 }),
      col({ id: "equipo", name: "Equipo", type: "text", width: 140 }),
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
    autoHintEs: "Se crea → 6 ítems",
    autoHintEn: "Created → 6 items",
    sampleRows: [
      {
        nombre: "Mansi R.",
        estado: "semana_1",
        responsable: "C.",
        inicio: "Sep 21",
        rol: "Design",
        equipo: "Product",
      },
      {
        nombre: "Luis O.",
        estado: "listo",
        responsable: "R.",
        inicio: "Sep 7",
        rol: "Eng",
        equipo: "Platform",
      },
      {
        nombre: "Ana P.",
        estado: "pendiente",
        responsable: "E.",
        inicio: "Oct 1",
        rol: "Ops",
        equipo: "Growth",
      },
    ],
  },
  {
    id: "risks",
    nameEs: "Riesgos",
    nameEn: "Risks",
    descriptionEs: "Severidad, dueño y revisión.",
    descriptionEn: "Severity, owner, and review.",
    shortEs: "Severidad y revisión",
    shortEn: "Severity and review",
    iconName: "AlertTriangle",
    icon: "⚠",
    color: "#A32D2D",
    iconBg: "#FCEBEB",
    iconFg: "#A32D2D",
    columns: [
      col({ id: "nombre", name: "Riesgo", type: "text", required: true, width: 220 }),
      col({
        id: "estado",
        name: "Estado",
        type: "status",
        options: [
          status("abierto", "Abierto", "danger"),
          status("mitigando", "Mitigando", "warning"),
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
    autoHintEs: "Revisión vencida → avisar",
    autoHintEn: "Review overdue → notify",
    sampleRows: [
      {
        nombre: "CHAMAN layout",
        estado: "mitigando",
        responsable: "E.",
        revision: "Sep 20",
        severidad: "alta",
        proyecto: "CHAMAN",
      },
      {
        nombre: "Token Brevo",
        estado: "abierto",
        responsable: "R.",
        revision: "Sep 17",
        severidad: "media",
        proyecto: "Ops",
      },
      {
        nombre: "GCP quotas",
        estado: "aceptado",
        responsable: "C.",
        revision: "Oct 5",
        severidad: "baja",
        proyecto: "Platform",
      },
    ],
  },
  {
    id: "requests",
    nameEs: "Solicitudes",
    nameEn: "Requests",
    descriptionEs: "Solicitudes del equipo y prioridad.",
    descriptionEn: "Team asks and priority.",
    shortEs: "Pedidos del equipo",
    shortEn: "Team asks",
    iconName: "Inbox",
    icon: "▸",
    color: "#854F0B",
    iconBg: "#FAEEDA",
    iconFg: "#854F0B",
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
    autoHintEs: "Se crea → ticket",
    autoHintEn: "Created → ticket",
    sampleRows: [
      {
        nombre: "Acceso Notion",
        estado: "nuevo",
        responsable: "R.",
        fecha: "Sep 18",
        solicitante: "M.",
        prioridad: "alta",
      },
      {
        nombre: "Logo CHAMAN",
        estado: "en_curso",
        responsable: "A.",
        fecha: "Sep 22",
        solicitante: "E.",
        prioridad: "media",
      },
      {
        nombre: "VPN staging",
        estado: "esperando",
        responsable: "C.",
        fecha: "Sep 25",
        solicitante: "L.",
        prioridad: "urgente",
      },
    ],
  },
  {
    id: "clients",
    nameEs: "Clientes",
    nameEn: "Clients",
    descriptionEs: "Relación, último contacto y siguiente paso.",
    descriptionEn: "Relationship, last touch, next step.",
    shortEs: "Relación y follow-up",
    shortEn: "Relationship & follow-up",
    iconName: "Users",
    icon: "◉",
    color: "#0E7490",
    iconBg: "#E1F5EE",
    iconFg: "#0E7490",
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
      trigger: { kind: "date_reached", offsetDays: 0 },
    },
    autoHintEs: "30 d sin contacto → follow-up",
    autoHintEn: "30 d no contact → follow-up",
    sampleRows: [
      {
        nombre: "Acquaroni",
        estado: "activo",
        responsable: "R.",
        ultimo_contacto: "Sep 12",
        empresa: "Acquaroni SA",
        email: "ops@acq.io",
      },
      {
        nombre: "KruOps",
        estado: "prospecto",
        responsable: "A.",
        ultimo_contacto: "Sep 8",
        empresa: "KruOps",
        email: "hi@kru.io",
      },
      {
        nombre: "Brevo Latam",
        estado: "en_riesgo",
        responsable: "E.",
        ultimo_contacto: "Ago 2",
        empresa: "Brevo",
        email: "latam@brevo.com",
      },
    ],
  },
  {
    id: "access",
    nameEs: "Accesos",
    nameEn: "Access",
    descriptionEs: "Sistemas, vencimiento y revisión.",
    descriptionEn: "Systems, expiry, and review.",
    shortEs: "Sistemas y vencimiento",
    shortEn: "Systems and expiry",
    iconName: "Key",
    icon: "⬡",
    color: "#5F5E5A",
    iconBg: "#F1F1EF",
    iconFg: "#5F5E5A",
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
    autoHintEs: "Vence → Revisar",
    autoHintEn: "Expires → Review",
    sampleRows: [
      {
        nombre: "GCP prod",
        estado: "activo",
        responsable: "E.",
        vence: "Dic 1",
        persona: "Regina",
        nivel: "admin",
      },
      {
        nombre: "Notion",
        estado: "revisar",
        responsable: "R.",
        vence: "Sep 20",
        persona: "César",
        nivel: "escritura",
      },
      {
        nombre: "Figma",
        estado: "pendiente",
        responsable: "A.",
        vence: "Oct 15",
        persona: "Mansi",
        nivel: "lectura",
      },
    ],
  },
  {
    id: "okrs",
    nameEs: "OKRs",
    nameEn: "OKRs",
    descriptionEs: "Objetivos, progreso y dueño.",
    descriptionEn: "Objectives, progress, and owner.",
    shortEs: "Objetivos del trimestre",
    shortEn: "Quarterly objectives",
    iconName: "Target",
    icon: "✦",
    color: "#3C3489",
    iconBg: "#EEEDFE",
    iconFg: "#3C3489",
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
    autoHintEs: "Viernes → resumen OKRs",
    autoHintEn: "Friday → OKR summary",
    sampleRows: [
      {
        nombre: "Activar Tables",
        estado: "on_track",
        responsable: "R.",
        fecha: "Sep 30",
        progreso: "70",
        kr: "8 templates live",
      },
      {
        nombre: "Calendar sync",
        estado: "at_risk",
        responsable: "E.",
        fecha: "Oct 15",
        progreso: "40",
        kr: "Google live",
      },
      {
        nombre: "NPS > 50",
        estado: "behind",
        responsable: "C.",
        fecha: "Dic 1",
        progreso: "20",
        kr: "Survey Q3",
      },
    ],
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

export function templateShortDescription(
  template: TableTemplate,
  locale: "es" | "en",
): string {
  return locale === "en" ? template.shortEn : template.shortEs;
}

export function templateAutoHint(
  template: TableTemplate,
  locale: "es" | "en",
): string {
  return locale === "en" ? template.autoHintEn : template.autoHintEs;
}

export function templateAutomationSentence(
  template: TableTemplate,
  locale: "es" | "en",
): string {
  return locale === "en"
    ? template.suggestedAutomation.sentenceEn
    : template.suggestedAutomation.sentenceEs;
}

/** Resolve a sample cell for display (status ids → labels). */
export function resolveSampleCell(
  columns: Column[],
  columnId: string,
  raw: string | undefined,
): { text: string; tone?: StatusOption["tone"] } {
  if (!raw) return { text: "—" };
  const column = columns.find((c) => c.id === columnId);
  if (column?.type === "status" && column.options) {
    const opt = column.options.find((o) => o.id === raw || o.label === raw);
    if (opt) return { text: opt.label, tone: opt.tone };
  }
  return { text: raw };
}

/** Convert display sample rows into createRecord values (status → id). */
export function sampleRowsToRecordValues(
  columns: Column[],
  row: TemplateSampleRow,
): Record<string, RecordValue> {
  const values: Record<string, RecordValue> = {};
  for (const column of columns) {
    const raw = row[column.id];
    if (raw == null || raw === "") continue;
    if (column.type === "status" && column.options) {
      const opt = column.options.find((o) => o.id === raw || o.label === raw);
      values[column.id] = opt?.id ?? raw;
      continue;
    }
    if (column.type === "currency" || column.type === "number") {
      const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
      if (!Number.isNaN(n)) {
        values[column.id] = n;
        continue;
      }
    }
    if (column.type === "tags") {
      values[column.id] = [raw];
      continue;
    }
    if (column.type === "file") continue;
    values[column.id] = raw;
  }
  return values;
}
