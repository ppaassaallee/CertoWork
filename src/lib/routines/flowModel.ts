/**
 * Per-routine flow model — the sentence drawn as typed nodes.
 * Deterministic; no canvas. Built from guided manifests or compiled automatic plans.
 */

export type FlowNodeType =
  | "trigger"
  | "prepare"
  | "step"
  | "decision"
  | "action"
  | "deliver"
  | "chain";

export type FlowBadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export type FlowBadge = {
  text: string;
  tone: FlowBadgeTone;
};

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  title: string;
  detail: string;
  badge?: FlowBadge;
  branches?: { yes: string; no: string };
  /** Field keys the NodePanel may edit. */
  editable: string[];
  /** Guided step id / manifest refs for persistence. */
  sourceStepId?: string;
  meta?: Record<string, unknown>;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
};

export type FlowModel = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type FlowRunStepOutcome = "done" | "skipped" | "approval" | "failed" | "pending";

export type FlowRunOverlay = {
  nodeId: string;
  outcome: FlowRunStepOutcome;
  note?: string;
};

export const ADD_STEP_MENU = [
  { id: "deliver_whatsapp", label: "Enviar también por WhatsApp", inserts: "deliver" as const },
  { id: "deliver_email", label: "Enviar también por correo", inserts: "deliver" as const },
  { id: "ask_approval", label: "Pedir aprobación antes", inserts: "decision" as const },
  { id: "wait_until", label: "Esperar hasta…", inserts: "action" as const },
  { id: "add_reflection", label: "Agregar una reflexión", inserts: "step" as const },
  { id: "odysseus_check", label: "Agregar un chequeo de Odysseus", inserts: "prepare" as const },
] as const;

export function linkNodes(nodes: FlowNode[]): FlowModel {
  const edges: FlowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({
      id: `e:${nodes[i].id}->${nodes[i + 1].id}`,
      from: nodes[i].id,
      to: nodes[i + 1].id,
    });
  }
  return { nodes, edges };
}
