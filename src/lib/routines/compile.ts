import {
  defaultRoutinePermissions,
  emptyRoutineStats,
  type RoutineChannel,
  type RoutineCompileResult,
  type RoutineEntityType,
  type RoutineScope,
  type RoutineTrigger,
} from "./types";
import { buildFlowFromPlan } from "./flowBuild";

function detectLanguage(sentence: string): "es" | "en" {
  const lower = sentence.toLowerCase();
  if (/\b(the|every|weekly|email me|summarize)\b/.test(lower)) return "en";
  return "es";
}

function detectChannel(sentence: string): RoutineChannel {
  const lower = sentence.toLowerCase();
  if (/whatsapp|wa\b/.test(lower)) return "whatsapp";
  if (/slack/.test(lower)) return "slack";
  if (/comentario|comment/.test(lower)) return "comment";
  if (/nota|note\b/.test(lower)) return "note";
  if (/webhook|http/.test(lower)) return "webhook";
  if (/asign|estim|dueño|owner|actualizar|update/.test(lower) && /aprob/.test(lower)) {
    return "update_items";
  }
  return "email";
}

function detectTrigger(sentence: string, timezone: string): RoutineTrigger {
  const lower = sentence.toLowerCase();

  if (/cuando.*bloque|when.*block/.test(lower)) {
    return {
      kind: "event",
      eventType: "item.blocked",
      cooldownSeconds: 3600,
      human: "Cuando un ítem se bloquee",
    };
  }
  if (/cuando.*done|cuando.*complet|when.*done/.test(lower)) {
    return {
      kind: "event",
      eventType: "item.status_changed",
      filter: { status: "done" },
      cooldownSeconds: 1800,
      human: "Cuando un ítem pase a Done",
    };
  }
  if (/cuando.*asign|when.*assign/.test(lower)) {
    return {
      kind: "event",
      eventType: "item.assigned",
      cooldownSeconds: 1800,
      human: "Cuando alguien asigne un ítem",
    };
  }
  if (/cuando.*nota|when.*note/.test(lower)) {
    return {
      kind: "event",
      eventType: "note.created",
      cooldownSeconds: 900,
      human: "Cuando se cree una nota",
    };
  }

  // Table automations — structured composer usually sets triggerOverride; these are light NL hints.
  if (
    /cuando\s+(se\s+)?cree\s+(un\s+)?registro|when\s+(a\s+)?record\s+is\s+created|nuevo\s+registro/.test(
      lower,
    )
  ) {
    return {
      kind: "event",
      eventType: "table.record_created",
      cooldownSeconds: 60,
      human: /when|record is created/i.test(lower)
        ? "When a record is created"
        : "Cuando se cree un registro",
    };
  }
  if (
    /cuando\s+(el\s+)?estado\s*(→|->|pase|cambia)|when\s+(the\s+)?status\s*(→|->|changes?)/.test(
      lower,
    )
  ) {
    const toMatch = lower.match(/(?:→|->|pase a|cambia a|changes? to)\s*([^\s,·]+)/i);
    const to = toMatch?.[1] ? String(toMatch[1]).replace(/['"]/g, "") : undefined;
    return {
      kind: "event",
      eventType: "table.status_changed",
      filter: to ? { to } : undefined,
      cooldownSeconds: 60,
      human: to
        ? /when|status|changes/i.test(lower)
          ? `When status → ${to}`
          : `Cuando el estado → ${to}`
        : /when|status/i.test(lower)
          ? "When status changes"
          : "Cuando cambie el estado",
    };
  }
  if (
    /(\d+)\s*d[ií]as?\s*(antes|before)|antes\s+de\s+la\s+fecha|before\s+(the\s+)?date|date_reached/.test(
      lower,
    )
  ) {
    const nMatch = lower.match(/(\d+)\s*d[ií]as?/);
    const offsetDays = nMatch ? Math.max(0, Number(nMatch[1])) : 0;
    return {
      kind: "event",
      eventType: "table.date_reached",
      filter: { offsetDays },
      cooldownSeconds: 86_400,
      human:
        offsetDays === 0
          ? /before|date|when/i.test(lower)
            ? "On the key date"
            : "El día de la fecha clave"
          : /before|when|days/i.test(lower)
            ? `${offsetDays} days before the date`
            : `${offsetDays} días antes de la fecha`,
    };
  }

  const weekdayMatch = lower.match(
    /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday)/,
  );
  const hourMatch = lower.match(/(?:a\s+las|at)\s+(\d{1,2})(?::(\d{2}))?/);
  const daily = /cada d[ií]a|diario|every day|cada ma[nñ]ana|every morning/.test(lower);
  const weekdays = /lun.?vie|lunes a viernes|weekdays|cada ma[nñ]ana de lunes/.test(lower);
  const everyNDays = lower.match(/cada\s+(\d+)\s+d[ií]as/);

  let hour = 7;
  let minute = 0;
  if (hourMatch) {
    hour = Math.min(23, Math.max(0, Number(hourMatch[1])));
    minute = hourMatch[2] ? Math.min(59, Number(hourMatch[2])) : 0;
  } else if (/16:00|4\s*pm|16\b/.test(lower)) {
    hour = 16;
  } else if (/8\b|08:00/.test(lower)) {
    hour = 8;
  } else if (/7:30|07:30/.test(lower)) {
    hour = 7;
    minute = 30;
  }

  const dayMap: Record<string, number> = {
    domingo: 0,
    sunday: 0,
    lunes: 1,
    monday: 1,
    martes: 2,
    tuesday: 2,
    miercoles: 3,
    miércoles: 3,
    wednesday: 3,
    jueves: 4,
    thursday: 4,
    viernes: 5,
    friday: 5,
    sabado: 6,
    sábado: 6,
    saturday: 6,
  };

  if (everyNDays) {
    const n = Math.max(1, Number(everyNDays[1]));
    return {
      kind: "schedule",
      human: `Cada ${n} días · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      cron: `${minute} ${hour} */${n} * *`,
      timezone,
    };
  }

  if (weekdays || (/ma[nñ]ana|morning/.test(lower) && !weekdayMatch)) {
    return {
      kind: "schedule",
      human: `Lun–Vie ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      cron: `${minute} ${hour} * * 1-5`,
      timezone,
    };
  }

  if (daily) {
    return {
      kind: "schedule",
      human: `Diario ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      cron: `${minute} ${hour} * * *`,
      timezone,
    };
  }

  if (weekdayMatch) {
    const day = dayMap[weekdayMatch[1]] ?? 1;
    const label = weekdayMatch[1].charAt(0).toUpperCase() + weekdayMatch[1].slice(1);
    return {
      kind: "schedule",
      human: `${label} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      cron: `${minute} ${hour} * * ${day}`,
      timezone,
    };
  }

  if (/ahora|manual|on demand|a demanda/.test(lower)) {
    return { kind: "manual", human: "Manual" };
  }

  // Default: weekday morning brief
  return {
    kind: "schedule",
    human: `Lun–Vie ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    cron: `${minute} ${hour} * * 1-5`,
    timezone,
  };
}

function titleFromSentence(sentence: string, _scopeTitle?: string): string {
  const trimmed = sentence.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 56) return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const short = trimmed.slice(0, 52).trim();
  return `${short}…`;
}

function goalFromSentence(sentence: string): string {
  return sentence.trim().replace(/\s+/g, " ");
}

function needsThirdPartyApproval(sentence: string, channel: RoutineChannel): boolean {
  const lower = sentence.toLowerCase();
  return (
    channel === "email" &&
    (/cliente|client|tercer|external|equipo de liderazgo|leadership/.test(lower) ||
      /para que yo lo apruebe|borrador|draft/.test(lower))
  );
}

/**
 * Deterministic sentence → RoutineSpec compiler (Phase 1).
 * Fast path — no LLM required. Worker may refine later.
 *
 * Table automations prefer a structured composer that passes `triggerOverride`
 * so event types table.* are fixed without relying on NL guess. Light NL
 * recognition for table.* still exists in detectTrigger as a fallback.
 */
export function compileRoutineSentence(input: {
  sentence: string;
  scope: RoutineScope;
  ownerEmail?: string;
  timezone?: string;
  recipeId?: string;
  /** When set (e.g. TableAutomationComposer), replaces NL-detected trigger. */
  triggerOverride?: RoutineTrigger;
}): RoutineCompileResult {
  const sentence = String(input.sentence || "").trim();
  const timezone = input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const language = detectLanguage(sentence);
  const channel = detectChannel(sentence);
  const trigger = input.triggerOverride || detectTrigger(sentence, timezone);
  const toThirdParties = needsThirdPartyApproval(sentence, channel);
  const owner = String(input.ownerEmail || "").trim();

  const questions =
    channel === "email" && toThirdParties && !/@/.test(sentence)
      ? [
          {
            id: "client_email",
            prompt: language === "es" ? "¿A qué correo del cliente?" : "Which client email?",
            suggested: "",
          },
        ]
      : [];

  const writeOthers = toThirdParties ? "ask" : "never";
  const editItems = /asign|estim|actualizar|update|propon/.test(sentence.toLowerCase())
    ? "ask"
    : "never";

  const scopeTitle = input.scope.entityTitle || input.scope.entityType;
  const estimatedMinutesSaved =
    trigger.kind === "schedule" ? 12 : trigger.kind === "event" ? 8 : 5;

  const draftSpec = {
    title: titleFromSentence(sentence, scopeTitle),
    sentence,
    scope: input.scope,
    trigger,
    goal: goalFromSentence(sentence),
    deliverable: {
      channel,
      to: channel === "email" && owner && !toThirdParties ? [owner] : owner ? [owner] : [],
      format: (/largo|long|detalle/.test(sentence.toLowerCase()) ? "long" : "short") as
        | "short"
        | "long",
      language,
    },
    permissions: {
      ...defaultRoutinePermissions(),
      editItems: editItems as "ask" | "never" | "always",
      writeOthers: writeOthers as "ask" | "never" | "always",
    },
    status: "draft" as const,
    recipeId: input.recipeId,
    class: "automatic" as const,
    stats: emptyRoutineStats(),
    nextRunAt: null,
    lastRunAt: null,
    lastRunStatus: null,
  };

  const plan = buildFlowFromPlan(draftSpec).nodes;

  return {
    spec: {
      ...draftSpec,
      plan,
    },
    questions,
    estimatedCostUsd: 0.02,
    estimatedMinutesSaved,
  };
}

export function buildDryRunPreview(input: {
  goal: string;
  scopeTitle: string;
  entityType: RoutineEntityType;
  itemCount?: number;
  blockedCount?: number;
  overdueCount?: number;
  language?: "es" | "en";
}): { text: string; steps: RoutineCompileResult extends never ? never : Array<{ kind: "read" | "think" | "draft" | "action" | "deliver"; label: string }> } {
  const lang = input.language || "es";
  const items = input.itemCount ?? 0;
  const blocked = input.blockedCount ?? 0;
  const overdue = input.overdueCount ?? 0;
  const name = input.scopeTitle || "este alcance";

  const steps = [
    {
      kind: "read" as const,
      nodeId: "prepare",
      label:
        lang === "es"
          ? `Leí el contexto de ${name}${items ? ` (${items} ítems)` : ""}`
          : `Read context for ${name}${items ? ` (${items} items)` : ""}`,
    },
    {
      kind: "think" as const,
      nodeId: "step:think",
      label:
        lang === "es"
          ? `Encontré ${blocked} bloqueos y ${overdue} vencidos / por vencer`
          : `Found ${blocked} blocked and ${overdue} due / overdue`,
    },
    {
      kind: "draft" as const,
      nodeId: "step:think",
      label: lang === "es" ? "Redacté el resultado" : "Drafted the deliverable",
    },
    {
      kind: "deliver" as const,
      nodeId: "deliver",
      label:
        lang === "es"
          ? "Vista previa lista (aún no se envió nada)"
          : "Preview ready (nothing was sent)",
    },
  ];

  const text =
    lang === "es"
      ? [
          `Vista previa — ${name}`,
          "",
          `Objetivo: ${input.goal}`,
          "",
          `• Ítems en alcance: ${items}`,
          `• Bloqueados: ${blocked}`,
          `• Vencidos / próximos: ${overdue}`,
          "",
          blocked || overdue
            ? "Atención: hay señales que conviene revisar antes de la próxima corrida real."
            : "Todo en orden en esta muestra. Al activar, la corrida usará datos frescos.",
          "",
          "— Certo Rutinas (prueba en seco)",
        ].join("\n")
      : [
          `Preview — ${name}`,
          "",
          `Goal: ${input.goal}`,
          "",
          `• Items in scope: ${items}`,
          `• Blocked: ${blocked}`,
          `• Due / overdue: ${overdue}`,
          "",
          blocked || overdue
            ? "Attention: there are signals worth reviewing before a live run."
            : "Looks calm in this sample. When activated, runs will use fresh data.",
          "",
          "— Certo Routines (dry run)",
        ].join("\n");

  return { text, steps };
}
