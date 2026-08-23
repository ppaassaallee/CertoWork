import {
  actionIdempotencyKey,
  decideActionPolicy,
  riskForActionType,
} from "./policy";
import type { AgentAction, AgentActionStatus } from "./types";

export type ExecuteActionInput = {
  workspaceId: string;
  agentId: string;
  agentVersionId: string;
  runId: string;
  actionType: string;
  payload: Record<string, unknown>;
  reason: string;
  fingerprint: string;
  policyOverrides?: Record<string, "allow" | "ask" | "deny">;
};

/**
 * Builds a governed AgentAction. Does not mutate Firestore by itself —
 * callers persist and, when approved, apply deterministic domain writes.
 */
export function proposeAgentAction(input: ExecuteActionInput): AgentAction {
  const decision = decideActionPolicy(input.actionType, input.policyOverrides);
  const status: AgentActionStatus =
    decision === "deny"
      ? "cancelled"
      : decision === "ask"
        ? "approval_required"
        : "approved";

  return {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    agentVersionId: input.agentVersionId,
    runId: input.runId,
    actionType: input.actionType,
    risk: riskForActionType(input.actionType),
    payload: input.payload,
    reason: input.reason,
    idempotencyKey: actionIdempotencyKey({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      runId: input.runId,
      actionType: input.actionType,
      fingerprint: input.fingerprint,
    }),
    status,
  };
}

export function assertActionExecutable(action: AgentAction) {
  if (action.status !== "approved" && action.status !== "proposed") {
    throw new Error(`Action ${action.actionType} is not executable (${action.status})`);
  }
}
