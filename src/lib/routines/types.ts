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
  | "person";

export type RoutinePermissionMode = "always" | "ask" | "never";

export type RoutineChannel =
  | "email"
  | "comment"
  | "note"
  | "whatsapp"
  | "slack"
  | "webhook"
  | "update_items";

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
        | "invoice.overdue";
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
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  stats: RoutineStats;
  recipeId?: string;
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
};

export const ROUTINES_COLLECTION = "routines";
export const ROUTINE_RUNS_COLLECTION = "routine_runs";
export const ROUTINE_RECIPES_COLLECTION = "recipes";

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
