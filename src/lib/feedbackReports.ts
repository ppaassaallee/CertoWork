export const FEEDBACK_KINDS = ["bug", "feature"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = [
  "submitted",
  "triaged",
  "converted",
  "closed",
  "wontfix",
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_SEVERITIES = ["low", "medium", "high"] as const;
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];

export type FeedbackReport = {
  id: string;
  userId?: string;
  workspaceId?: string;
  createdBy?: string;
  kind?: FeedbackKind | string;
  title?: string;
  description?: string;
  status?: FeedbackStatus | string;
  projectId?: string | null;
  severity?: FeedbackSeverity | string | null;
  reporterAlias?: string;
  reporterEmoji?: string;
  adminNote?: string;
  convertedToType?: string;
  convertedToId?: string;
  convertedBy?: string;
  convertedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  triagedAt?: unknown;
};

export function isFeedbackKind(value?: string | null): value is FeedbackKind {
  return FEEDBACK_KINDS.includes(String(value || "") as FeedbackKind);
}

export function isFeedbackStatus(value?: string | null): value is FeedbackStatus {
  return FEEDBACK_STATUSES.includes(String(value || "") as FeedbackStatus);
}

export function feedbackKindLabel(kind?: string | null) {
  return String(kind || "").toLowerCase() === "bug" ? "Bug" : "Feature";
}

export function feedbackStatusLabel(status?: string | null) {
  const value = String(status || "submitted").toLowerCase();
  if (value === "triaged") return "Triaged";
  if (value === "converted") return "Converted to PBI";
  if (value === "closed") return "Closed";
  if (value === "wontfix") return "Won't fix";
  return "Submitted";
}

export function workItemTypeForFeedback(kind?: string | null) {
  return String(kind || "").toLowerCase() === "bug" ? "bug" : "pbi";
}

export function openFeedbackStatuses() {
  return ["submitted", "triaged"] as const;
}

export function isOpenFeedback(status?: string | null) {
  return openFeedbackStatuses().includes(
    String(status || "submitted") as "submitted" | "triaged",
  );
}

export function feedbackToTaskPatch(report: FeedbackReport) {
  const kind = isFeedbackKind(report.kind) ? report.kind : "feature";
  const workItemType = workItemTypeForFeedback(kind);
  const description = [
    String(report.description || "").trim(),
    `Reported via SupportOps as a ${feedbackKindLabel(kind).toLowerCase()}.`,
    report.severity ? `Severity: ${report.severity}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    workItemType,
    itemType: workItemType,
    taskType: workItemType,
    source: "user_feedback",
    description,
    reporterId: report.userId || report.createdBy || "",
    severity: kind === "bug" ? report.severity || "medium" : null,
    labels: ["feedback", kind],
    linkedEntityType: "feedback_report",
    linkedEntityId: report.id,
    workCategory: "Product development",
    productPhase: "Explore",
  };
}
