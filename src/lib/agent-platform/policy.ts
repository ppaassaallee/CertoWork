/** Deterministic Certo business action policy — model is not the authority. */

import type { AgentActionRisk } from "./types";

export type PolicyDecision = "allow" | "ask" | "deny";

const DEFAULTS: Record<string, PolicyDecision> = {
  read: "allow",
  analyze: "allow",
  create_draft: "allow",
  prepare_report: "allow",
  create_review_candidate: "allow",
  create_task: "ask",
  update_task: "ask",
  update_project: "ask",
  create_project: "ask",
  outbox_communication: "ask",
  delete: "ask",
  kill_or_archive: "ask",
  remember_fact: "allow",
  manage_members: "deny",
  read_secret: "deny",
  financial_transaction: "deny",
};

export function decideActionPolicy(
  actionType: string,
  overrides: Record<string, PolicyDecision> = {},
): PolicyDecision {
  const key = String(actionType || "").trim();
  if (overrides[key]) return overrides[key];
  if (DEFAULTS[key]) return DEFAULTS[key];
  if (key.startsWith("propose_") || key.startsWith("create_")) return "ask";
  if (key.startsWith("get_") || key.startsWith("search_") || key.startsWith("list_")) {
    return "allow";
  }
  return "ask";
}

export function riskForActionType(actionType: string): AgentActionRisk {
  const decision = decideActionPolicy(actionType);
  if (decision === "deny") return "privileged";
  if (
    ["delete", "kill_or_archive", "manage_members"].includes(actionType)
  ) {
    return "destructive";
  }
  if (actionType === "outbox_communication") return "external_side_effect";
  if (decision === "ask") return "internal_reversible";
  if (actionType.includes("draft") || actionType.includes("report")) return "draft";
  return "read";
}

export function actionIdempotencyKey(parts: {
  workspaceId: string;
  agentId: string;
  runId: string;
  actionType: string;
  fingerprint: string;
}) {
  return [
    parts.workspaceId,
    parts.agentId,
    parts.runId,
    parts.actionType,
    parts.fingerprint,
  ].join(":");
}
