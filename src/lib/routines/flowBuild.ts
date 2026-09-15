import type { RecipeManifest, PrepareSpec } from "./manifest";
import type { RoutineSpec } from "./types";
import { linkNodes, type FlowModel, type FlowNode } from "./flowModel";

const GATHER_LABELS: Record<PrepareSpec["gather"][number], string> = {
  planned_items: "planeados",
  done_items: "hechos",
  undone_items: "no hechos",
  blocked_items: "bloqueados",
  win_signals: "señales de wins",
  prior_goals: "metas anteriores",
  protected_blocks: "bloques protegidos",
  week_deadlines: "vencimientos de la semana",
  epic_candidates: "candidatos a épica",
  calendar_load: "carga de calendario",
  last_alignment: "última alineación",
  day_summary: "resumen del día",
};

function prepareDetail(gather: PrepareSpec["gather"]) {
  return `Lee: ${gather.map((key) => GATHER_LABELS[key] || key).join(" · ")}`;
}

function stepHasItemTriage(step: RecipeManifest["steps"][number]) {
  return step.cards.some((card) => card.type === "ItemTriage");
}

function permissionBadge(mode: string | undefined): FlowNode["badge"] | undefined {
  if (mode === "always") return { text: "mueve ítems · permitido", tone: "success" };
  if (mode === "ask") return { text: "mueve ítems · pregunta", tone: "warning" };
  if (mode === "never") return { text: "mueve ítems · nunca", tone: "danger" };
  return { text: "mueve ítems · permitido", tone: "success" };
}

export function buildFlowFromManifest(
  manifest: RecipeManifest,
  spec?: Pick<RoutineSpec, "permissions" | "trigger" | "deliverable"> | null,
): FlowModel {
  const nodes: FlowNode[] = [];
  const triggerHuman =
    (spec?.trigger as { human?: string } | undefined)?.human ||
    manifest.cadence.humanText ||
    "Manual";

  nodes.push({
    id: "trigger",
    type: "trigger",
    title: triggerHuman,
    detail: `Disparador · ${manifest.cadence.default}${
      manifest.expiresWeekday != null
        ? " · si no la hacés, espera hasta el lunes"
        : ""
    }`,
    editable: ["schedule", "timezone"],
    meta: { cron: manifest.cadence.cron },
  });

  nodes.push({
    id: "prepare",
    type: "prepare",
    title: "Odysseus prepara la semana",
    detail: prepareDetail(manifest.prepare.gather),
    badge: { text: "solo lectura", tone: "neutral" },
    editable: [],
  });

  const editItems = spec?.permissions?.editItems || manifest.permissions?.editItems || "always";

  manifest.steps.forEach((step, index) => {
    const badge = stepHasItemTriage(step)
      ? permissionBadge(editItems)
      : step.savesAs?.blockType
        ? {
            text: `bloque ${step.savesAs.blockType.charAt(0).toUpperCase()}${step.savesAs.blockType.slice(1)}`,
            tone: "accent" as const,
          }
        : undefined;

    nodes.push({
      id: `step:${step.id}`,
      type: "step",
      title: `${index + 1} · ${step.question}`,
      detail: step.hint || step.label,
      badge,
      editable: ["question", "hint", "skippable", "includeInSummary", "savesAs"],
      sourceStepId: step.id,
      meta: {
        label: step.label,
        question: step.question,
        hint: step.hint,
        skippable: step.skippable,
        skipInSummary: Boolean(step.skipInSummary),
        savesAs: step.savesAs?.blockType,
        cards: step.cards,
      },
    });
  });

  if (manifest.chainsTo) {
    nodes.push({
      id: "decision:chain",
      type: "decision",
      title: "¿Planear la semana ahora?",
      detail: `Sí → encadena ${manifest.chainsTo} · No → queda para después`,
      branches: {
        yes: `Encadena ${manifest.chainsTo}`,
        no: "Queda para más tarde",
      },
      editable: [],
      meta: { chainsTo: manifest.chainsTo },
    });
  }

  const noteTitle = manifest.output.note.titleTemplate.replace("{weekLabel}", "Semana");
  nodes.push({
    id: "deliver",
    type: "deliver",
    title: `Guarda "${noteTitle}"`,
    detail: `Nota con ${manifest.output.note.blocks.length} bloques en ${manifest.output.note.notebook} · entrega`,
    badge: { text: "entrega", tone: "neutral" },
    editable: ["channel", "recipients", "format"],
    meta: {
      notebook: manifest.output.note.notebook,
      blocks: manifest.output.note.blocks,
      channel: spec?.deliverable?.channel || "session",
    },
  });

  return linkNodes(nodes);
}

export function buildFlowFromPlan(
  spec: Pick<
    RoutineSpec,
    "title" | "goal" | "trigger" | "deliverable" | "permissions" | "plan" | "sentence"
  >,
): FlowModel {
  if (Array.isArray(spec.plan) && spec.plan.length > 0) {
    return linkNodes(spec.plan as FlowNode[]);
  }

  const nodes: FlowNode[] = [];
  const trigger = spec.trigger as { human?: string; kind?: string };
  nodes.push({
    id: "trigger",
    type: "trigger",
    title: trigger.human || "Manual",
    detail: `Disparador · ${trigger.kind || "manual"}`,
    editable: ["schedule", "timezone"],
  });

  nodes.push({
    id: "prepare",
    type: "prepare",
    title: "Odysseus lee el contexto",
    detail: "Herramientas de lectura sobre el alcance",
    badge: { text: "solo lectura", tone: "neutral" },
    editable: [],
  });

  nodes.push({
    id: "step:think",
    type: "step",
    title: spec.goal || spec.sentence || "Pensar y redactar",
    detail: "Piensa / redacta el resultado",
    editable: ["question", "hint"],
    meta: { kind: "think" },
  });

  const editItems = spec.permissions?.editItems || "ask";
  if (editItems !== "never") {
    nodes.push({
      id: "decision:editItems",
      type: "decision",
      title: "¿Editar ítems?",
      detail:
        editItems === "always"
          ? "Permitido · sin preguntar"
          : "Pregunta antes de tocar ítems",
      branches: {
        yes: editItems === "always" ? "Edita" : "Pide aprobación",
        no: "Solo lectura",
      },
      editable: ["permission"],
      meta: { policy: "editItems", mode: editItems },
    });
  }

  const writeOthers = spec.permissions?.writeOthers || "ask";
  if (writeOthers !== "never") {
    nodes.push({
      id: "decision:writeOthers",
      type: "decision",
      title: "¿Escribir a otros?",
      detail:
        writeOthers === "always"
          ? "Permitido · sin preguntar"
          : "Pregunta antes de escribir a terceros",
      branches: {
        yes: writeOthers === "always" ? "Envía" : "Pide aprobación",
        no: "Solo al dueño",
      },
      editable: ["permission"],
      meta: { policy: "writeOthers", mode: writeOthers },
    });
  }

  for (const actionType of spec.permissions?.approvedActionTypes || []) {
    nodes.push({
      id: `action:${actionType}`,
      type: "action",
      title: actionType,
      detail: "Acción aprobada",
      badge: { text: "permitido", tone: "success" },
      editable: ["permission"],
    });
  }

  const channel = spec.deliverable?.channel || "email";
  const to = (spec.deliverable?.to || []).join(", ") || "dueño";
  nodes.push({
    id: "deliver",
    type: "deliver",
    title:
      channel === "email"
        ? `Correo a ${to}`
        : channel === "whatsapp"
          ? `WhatsApp a ${to}`
          : `Entrega · ${channel}`,
    detail: `Formato ${spec.deliverable?.format || "short"} · ${spec.deliverable?.language || "es"}`,
    badge: { text: "entrega", tone: "neutral" },
    editable: ["channel", "recipients", "format"],
  });

  return linkNodes(nodes);
}

export function resolveRoutineFlow(
  spec: RoutineSpec,
  manifest?: RecipeManifest | null,
): FlowModel {
  if (manifest && (spec.class === "guided" || manifest.class === "guided")) {
    return buildFlowFromManifest(manifest, spec);
  }
  return buildFlowFromPlan(spec);
}
