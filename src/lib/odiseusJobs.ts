/** Odiseus job/run helpers — durable execution metadata on messages and runs. */

export type OdiseusRunStatus =
  | "queued"
  | "planning"
  | "working"
  | "waiting_for_approval"
  | "waiting_for_input"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export type OdiseusRunStep = {
  id?: string;
  tool?: string;
  label: string;
  status: "queued" | "working" | "done" | "failed";
  at?: number;
};

export type OdiseusRun = {
  status: OdiseusRunStatus;
  steps?: OdiseusRunStep[];
  toolCount?: number;
  artifact?: {
    kind: string;
    title: string;
    summary?: string;
    body?: string;
    projectId?: string | null;
  } | null;
  error?: string | null;
};

export function normalizeOdiseusRun(raw: any): OdiseusRun | null {
  if (!raw || typeof raw !== "object") return null;
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map((step: any, index: number) => ({
        id: String(step?.id || `${step?.tool || "step"}-${index}`),
        tool: step?.tool ? String(step.tool) : undefined,
        label: String(step?.label || step?.tool || "Working"),
        status: (["queued", "working", "done", "failed"].includes(step?.status)
          ? step.status
          : "done") as OdiseusRunStep["status"],
        at: typeof step?.at === "number" ? step.at : undefined,
      }))
    : [];
  return {
    status: (raw.status || "completed") as OdiseusRunStatus,
    steps,
    toolCount: Number(raw.toolCount || steps.length) || 0,
    artifact: raw.artifact || null,
    error: raw.error || null,
  };
}

export function actionIdempotencyKey(
  planId: string,
  index: number,
  action: { type?: string; proposedChange?: Record<string, unknown> },
) {
  const change = action.proposedChange || {};
  const fingerprint = [
    action.type || "unknown",
    change.projectId || "",
    change.sourceTaskId || change.taskId || change.id || "",
    String(change.title || "").slice(0, 80),
  ].join(":");
  return `odiseus:${planId}:${index}:${fingerprint}`;
}
