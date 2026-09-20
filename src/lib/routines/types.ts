/**
 * Certo Rutinas — product contracts (Phase 1).
 * A routine is a sentence that becomes a readable card; steps appear after each run.
 */

export type RoutineEntityType =
  | "project"
  | "task"
  | "note"
  | "request"
  | "invoice"
  | "portfolio"
  | "person"
  | "table"
  | "record";

export type RoutinePermissionMode = "always" | "ask" | "never";

export type RoutineChannel =
  | "email"
  | "comment"
  | "note"
  | "whatsapp"
  | "slack"
  | "webhook"
  | "update_items"
  | "session";

/** How the routine runs when due. */
export type RoutineClass = "automatic" | "guided" | "manual";

export type RoutineStatus = "draft" | "active" | "paused" | "failing";

export type RoutineTrigger =
  | {
      kind: "schedule";
      human: string;
      cron: string;
      timezone: string;
    }
  | {
      kind: "event";
      eventType:
        | "item.blocked"
        | "item.status_changed"
        | "item.assigned"
        | "item.due_soon"
        | "note.created"
        | "request.stale"
        | "invoice.overdue"
        | "table.record_created"
        | "table.status_changed"
        | "table.date_reached";
      /**
       * Optional match criteria. For table.* events use
       * `{ tableId, columnId?, to?, offsetDays? }`.
       */
      filter?: Record<string, unknown>;
      cooldownSeconds: number;
      human: string;
    }
  | {
      kind: "webhook";
      secretRef: string;
      human: string;
    }
  | {
      kind: "manual";
      human: string;
    };

export type RoutineDeliverable = {
  channel: RoutineChannel;
  to: string[];
  format: "short" | "long";
  language: "es" | "en";
};

export type RoutinePermissions = {
  readCerto: "always";
  writeOwner: "always";
  editItems: RoutinePermissionMode;
  writeOthers: RoutinePermissionMode;
  approvedActionTypes: string[];
};

export type RoutineStats = {
  runs30d: number;
  success30d: number;
  actions30d: number;
  pending: number;
  minutesSavedEstimate: number;
  costUsd30d: number;
};

export type RoutineScope = {
  entityType: RoutineEntityType;
  entityId: string | null;
  entityTitle?: string;
};

export type RoutineSpec = {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  title: string;
  sentence: string;
  scope: RoutineScope;
  trigger: RoutineTrigger;
  goal: string;
  deliverable: RoutineDeliverable;
  permissions: RoutinePermissions;
  status: RoutineStatus;
  /** automatic (default) | guided ritual | manual */
  class?: RoutineClass;
  recipeId?: string;
  /** Deterministic table automations — same executor, no LLM unless action is odysseus. */
  structured?: import("./structured").StructuredRoutine | null;
  /**
   * Persisted flow plan for automatic routines (and optional overrides).
   * Guided rituals usually rebuild from their manifest; plan is the drawn sentence.
   */
  plan?: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    badge?: { text: string; tone: string };
    branches?: { yes: string; no: string };
    editable: string[];
    sourceStepId?: string;
    meta?: Record<string, unknown>;
  }>;
  /** User overrides for guided step questions keyed by step id. */
  stepOverrides?: Record<
    string,
    { question?: string; hint?: string; skippable?: boolean; skipInSummary?: boolean }
  >;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  stats: RoutineStats;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RoutineCompileQuestion = {
  id: string;
  prompt: string;
  suggested?: string;
};

export type RoutineCompileResult = {
  spec: Omit<
    RoutineSpec,
    "id" | "workspaceId" | "ownerUserId" | "createdAt" | "updatedAt" | "stats" | "nextRunAt" | "lastRunAt" | "lastRunStatus"
  > & {
    stats?: RoutineStats;
    nextRunAt?: string | null;
    lastRunAt?: string | null;
    lastRunStatus?: string | null;
  };
  questions: RoutineCompileQuestion[];
  estimatedCostUsd: number;
  estimatedMinutesSaved: number;
};

export type RoutinePreviewResult = {
  text: string;
  html?: string;
  steps: Array<{
    kind: "read" | "think" | "draft" | "action" | "deliver";
    label: string;
    /** Maps onto FlowNode.id when the plan is drawn / a run is overlaid. */
    nodeId?: string;
  }>;
  usage?: { inputTokens?: number; outputTokens?: number; costUsd?: number; durationMs?: number };
};

export type RoutineRecipe = {
  id: string;
  title: string;
  sentence: string;
  entityTypes: RoutineEntityType[];
  triggerHint: string;
  deliverableHint: string;
  /** Gallery filter — personal rituals vs project/portfolio. */
  domain?: "personal" | "project" | "portfolio";
  estimatedMinutes?: number;
  class?: RoutineClass;
};

export const ROUTINES_COLLECTION = "routines";
export const ROUTINE_RUNS_COLLECTION = "routine_runs";
export const ROUTINE_RECIPES_COLLECTION = "recipes";
export const ROUTINE_SESSIONS_COLLECTION = "routine_sessions";

export function emptyRoutineStats(): RoutineStats {
  return {
    runs30d: 0,
    success30d: 0,
    actions30d: 0,
    pending: 0,
    minutesSavedEstimate: 0,
    costUsd30d: 0,
  };
}

export function defaultRoutinePermissions(): RoutinePermissions {
  return {
    readCerto: "always",
    writeOwner: "always",
    editItems: "ask",
    writeOthers: "ask",
    approvedActionTypes: [],
  };
}
