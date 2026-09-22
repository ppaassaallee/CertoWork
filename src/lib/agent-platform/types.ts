/**
 * Certo Agent Platform — product contracts (Prompt 2).
 * Hermes is the execution harness; Certo owns policy and data.
 */

export type AgentScope = "personal" | "workspace";
export type AgentStatus =
  | "draft"
  | "testing"
  | "published"
  | "paused"
  | "archived";

export type NormalizedRunStatus =
  | "queued"
  | "provisioning"
  | "starting"
  | "running"
  | "waiting_for_input"
  | "waiting_for_business_approval"
  | "waiting_for_runtime_approval"
  | "stopping"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown";

export type AgentActionRisk =
  | "read"
  | "draft"
  | "internal_reversible"
  | "external_side_effect"
  | "destructive"
  | "privileged";

export type AgentActionStatus =
  | "proposed"
  | "approval_required"
  | "approved"
  | "rejected"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type TriggerType =
  | "manual"
  | "schedule"
  | "domain_event"
  | "webhook"
  | "integration_event";

export interface AgentDefinition {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description: string;
  scope: AgentScope;
  status: AgentStatus;
  source: {
    type:
      | "built_in"
      | "certo"
      | "hermes_distribution"
      | "hermes_profile_export"
      | "connected_hermes";
    uri?: string;
    sourceVersion?: string;
  };
  currentVersionId: string | null;
  runtime: "hermes" | "legacy_odysseus";
  runtimeBindingId: string | null;
  visibility: "private" | "workspace";
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AgentVersion {
  id: string;
  workspaceId: string;
  agentId: string;
  version: number;
  instructions: string;
  /** Short statement of what this agent owns. */
  owns?: string;
  /** Outcome the agent works toward. */
  outcome?: string;
  icon?: { emoji?: string; color?: string };
  model?: {
    provider: string;
    name: string;
    tier: "fast" | "balanced" | "deep";
  };
  skills: Array<{ skillId: string; name: string }>;
  dataAccess: Array<{ resource: string; mode: "read" | "propose" }>;
  connections: Array<{
    connectionId: string;
    allowedTools: string[];
    account?: { mode: "service" | "user"; userId?: string };
  }>;
  actionPolicy: Record<string, "allow" | "ask" | "deny">;
  memoryPolicy: { recall: boolean; rememberRequiresApproval: boolean };
  runtimePolicy: { terminal: boolean; browser: boolean; web: boolean };
  checksum: string;
  createdBy: string;
  createdAt?: unknown;
}

export interface AgentTriggerFilters {
  projectIds?: string[];
  states?: string[];
  labels?: string[];
  assigneeIds?: string[];
  types?: string[];
}

export type AgentDomainEvent =
  | "created"
  | "updated"
  | "state_changed"
  | "reassigned"
  | "removed"
  | "assigned_to_agent"
  | "mentioned";

export interface AgentTrigger {
  id?: string;
  workspaceId: string;
  agentId: string;
  agentVersionId: string;
  type: TriggerType;
  enabled: boolean;
  eventType?: string;
  /** Domain events this trigger listens to (when type is domain_event). */
  events?: AgentDomainEvent[];
  filters?: AgentTriggerFilters;
  schedule?: string;
  timezone?: string;
  hermesJobId?: string;
  cooldownSeconds?: number;
}

export interface AgentRunRecord {
  id?: string;
  workspaceId: string;
  agentId: string;
  agentVersionId: string;
  triggerType: TriggerType;
  status: NormalizedRunStatus;
  hermesProfile?: string;
  hermesRunId?: string;
  inputSummary: string;
  resultSummary?: string;
  /** Live step label for board/list activity chips. */
  currentStepLabel?: string;
  /** Optional warning finding shown as a signal chip. */
  findingLabel?: string;
  eventType?: string;
  context?: {
    itemId?: string;
    projectId?: string;
    conversationId?: string;
    messageId?: string;
  };
  traceId: string;
  correlationId: string;
  causationId?: string;
  depth?: number;
  errorMessage?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AgentTemplate {
  id: string;
  workspaceId?: string | null;
  name: string;
  description: string;
  owns: string;
  outcome: string;
  worksOn: string[];
  skillNames: string[];
  system: boolean;
  versionSeed: Partial<AgentVersion>;
  triggerSeeds: Array<Partial<AgentTrigger>>;
}

export interface AgentRuntimeBinding {
  id: string;
  workspaceId: string;
  agentId: string;
  runtimeInstanceId: string;
  hermesProfile: string;
  secretRef: string;
  status: "provisioning" | "ready" | "error" | "paused";
  lastHealthCheckAt?: unknown;
}

export interface RuntimeInstance {
  id: string;
  environment: "development" | "staging" | "production";
  provider: "gcp" | "local";
  runtime: "hermes";
  region: string;
  endpoint: string;
  status: "provisioning" | "healthy" | "degraded" | "offline" | "maintenance";
  hermesVersion: string;
}

export interface AgentAction {
  id?: string;
  workspaceId: string;
  agentId: string;
  agentVersionId: string;
  runId: string;
  actionType: string;
  risk: AgentActionRisk;
  target?: Record<string, unknown>;
  payload: Record<string, unknown>;
  evidenceRefs?: Array<{ type: string; id: string }>;
  reason: string;
  idempotencyKey: string;
  status: AgentActionStatus;
}

export const BUILT_IN_ODYSSEUS_SLUG = "odysseus";

export function opaqueHermesProfileId(agentId: string) {
  const compact = String(agentId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12)
    .toLowerCase();
  return `cw-a-${compact || "unknown"}`;
}

/** Stable Hermes session key for one person inside one workspace. */
export function opaqueHermesUserProfileId(workspaceId?: string | null, userId?: string | null) {
  const compact = `${workspaceId || ""}:${userId || ""}`
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 40)
    .toLowerCase();
  return `cw-u-${compact || "unknown"}`;
}
