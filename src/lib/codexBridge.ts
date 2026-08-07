export type CodexSyncMode = "completion_and_notes" | "review_every_change";

export type CodexConnection = {
  id: string;
  workspaceId: string;
  projectId: string;
  conversationId?: string | null;
  handoffCode: string;
  repositoryRoot?: string;
  repositoryUrl?: string;
  codexTaskReference?: string;
  syncMode: CodexSyncMode;
  workItemIds: string[];
  status: "ready" | "connected" | "error" | "disabled";
  lastSyncAt?: unknown;
  lastError?: string;
};

export type CodexBridgeEvent = {
  id: string;
  connectionId: string;
  workItemId?: string;
  kind: "work_item_claimed" | "work_item_progress" | "work_item_completed" | "project_gap" | string;
  status: "pending" | "authorized" | "applied" | "rejected";
  payload: Record<string, any>;
  createdAt?: string;
};

const EXECUTABLE_TYPES = new Set(["pbi", "story", "task", "bug", "subtask"]);

export function workItemType(item: any) {
  const value = String(
    item?.workItemType || item?.type || item?.itemType || item?.taskType || item?.issueType || "task",
  ).toLowerCase();
  if (["epic", "feature", "pbi", "story", "task", "bug", "subtask"].includes(value)) return value;
  return value.includes("epic") ? "epic" : value.includes("feature") ? "feature" : "task";
}

export function isExecutableWorkItem(item: any) {
  return EXECUTABLE_TYPES.has(workItemType(item));
}

export function createHandoffCode() {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `DOS-${random}`;
}

function timestampValue(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (value?.toDate) return value.toDate().toISOString();
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString();
  return null;
}

export function serializeCodexWorkItem(item: any, selected: boolean, index = 0) {
  return {
    id: String(item.id),
    key: String(item.key || item.workItemKey || ""),
    title: String(item.title || item.name || "Untitled"),
    type: workItemType(item),
    status: String(item.status || "backlog"),
    priority: item.priority == null ? null : String(item.priority),
    parentId: item.parentId || null,
    epicId: item.epicId || null,
    featureId: item.featureId || null,
    sprintId: item.sprintId || null,
    assignee: item.assignee || item.owner || null,
    description: String(item.description || "").slice(0, 12_000),
    acceptanceCriteria: String(item.acceptanceCriteria || "").slice(0, 12_000),
    requirementIds: Array.isArray(item.requirementIds) ? item.requirementIds.slice(0, 50) : [],
    dependencyIds: Array.isArray(item.dependencyIds || item.dependencies)
      ? (item.dependencyIds || item.dependencies).slice(0, 50)
      : [],
    dueDate: timestampValue(item.dueDate),
    updatedAt: timestampValue(item.updatedAt),
    order: Number(item.order ?? item.rank ?? index),
    readyForCodex: selected,
  };
}

export function buildCodexHandoffBrief({
  connection,
  project,
  workItems,
}: {
  connection: Pick<CodexConnection, "handoffCode" | "repositoryRoot" | "repositoryUrl" | "syncMode">;
  project: any;
  workItems: any[];
}) {
  const selected = workItems.filter((item) => item.readyForCodex);
  const itemList = selected.length
    ? selected.map((item) => `- ${item.key ? `${item.key} · ` : ""}${item.title} [${item.type}]`).join("\n")
    : "- No executable work item selected yet. Ask me to choose one before coding.";
  const repository = connection.repositoryRoot || connection.repositoryUrl || "Repository not recorded";
  const reviewMode = connection.syncMode === "completion_and_notes"
    ? "Progress, completion evidence, and delivery notes are pre-approved for this handoff. Scope changes still require review."
    : "Every proposed DelivereeOS change requires review in the Project Console.";

  return `You are working from a DelivereeOS delivery handoff.

Handoff code: ${connection.handoffCode}
Project: ${project.title || project.name || "Untitled project"}
Project ID: ${project.id}
Repository: ${repository}

Start by using the DelivereeOS Bridge tools:
1. Call get_delivery_context with handoffCode ${connection.handoffCode}.
2. Call link_codex_task for this Codex task.
3. Claim only the work item(s) you will execute.
4. Keep DelivereeOS current with report_work_item_progress.
5. Before declaring done, run relevant tests and call complete_work_item with files changed, tests, acceptance evidence, commit/PR/deployment links when real, knowledge notes, and remaining gaps.

Selected work:
${itemList}

Rules:
- DelivereeOS is the delivery source of truth; the bridge snapshot is scoped context.
- Do not invent GitHub, build, deployment, test, or completion status.
- Preserve work-item IDs and hierarchy.
- If information is missing, report a project gap and continue with the safe work that can be completed.
- ${reviewMode}`;
}

export function codexEventTaskPatch(event: CodexBridgeEvent) {
  const payload = event.payload || {};
  const allowedStatuses = new Set([
    "backlog", "ready", "todo", "in_progress", "in_review", "blocked", "done", "cancelled",
  ]);
  const nextStatus = allowedStatuses.has(String(payload.status || "").toLowerCase())
    ? String(payload.status).toLowerCase()
    : event.kind === "work_item_completed" ? "done" : undefined;
  return {
    ...(nextStatus ? { status: nextStatus } : {}),
    codexStatus: event.kind === "work_item_completed" ? "completed" : String(payload.status || "updated"),
    codexRunId: payload.runId || null,
    codexTaskReference: payload.codexTaskReference || null,
    codexLastSummary: String(payload.summary || "").slice(0, 4_000),
    deliveryEvidence: {
      filesChanged: Array.isArray(payload.filesChanged) ? payload.filesChanged.slice(0, 100) : [],
      tests: Array.isArray(payload.tests) ? payload.tests.slice(0, 100) : [],
      acceptanceEvidence: Array.isArray(payload.acceptanceEvidence)
        ? payload.acceptanceEvidence.slice(0, 100)
        : [],
      commitSha: payload.commitSha || null,
      pullRequestUrl: payload.pullRequestUrl || null,
      deploymentUrl: payload.deploymentUrl || null,
      blockers: Array.isArray(payload.blockers) ? payload.blockers.slice(0, 50) : [],
      remainingGaps: Array.isArray(payload.remainingGaps) ? payload.remainingGaps.slice(0, 50) : [],
    },
  };
}

export function deliveryEvidenceDocument(event: CodexBridgeEvent, workItem: any, project: any) {
  const payload = event.payload || {};
  const lines = [
    `# Delivery evidence · ${workItem?.key ? `${workItem.key} · ` : ""}${workItem?.title || "Work item"}`,
    "",
    `Project: ${project?.title || project?.name || "Untitled project"}`,
    `Status: ${payload.status || (event.kind === "work_item_completed" ? "done" : "updated")}`,
    payload.summary ? `Summary: ${payload.summary}` : "",
    payload.commitSha ? `Commit: ${payload.commitSha}` : "",
    payload.pullRequestUrl ? `Pull request: ${payload.pullRequestUrl}` : "",
    payload.deploymentUrl ? `Deployment: ${payload.deploymentUrl}` : "",
    "",
    ...(Array.isArray(payload.filesChanged) && payload.filesChanged.length
      ? ["## Files changed", ...payload.filesChanged.map((value: string) => `- ${value}`), ""]
      : []),
    ...(Array.isArray(payload.tests) && payload.tests.length
      ? ["## Tests", ...payload.tests.map((value: string) => `- ${value}`), ""]
      : []),
    ...(Array.isArray(payload.acceptanceEvidence) && payload.acceptanceEvidence.length
      ? ["## Acceptance evidence", ...payload.acceptanceEvidence.map((value: string) => `- ${value}`), ""]
      : []),
    ...(Array.isArray(payload.knowledgeNotes) && payload.knowledgeNotes.length
      ? ["## Knowledge notes", ...payload.knowledgeNotes.map((value: string) => `- ${value}`), ""]
      : []),
    ...(Array.isArray(payload.remainingGaps) && payload.remainingGaps.length
      ? ["## Remaining gaps", ...payload.remainingGaps.map((value: string) => `- ${value}`)]
      : []),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
