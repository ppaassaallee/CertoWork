export function normalizeAccessEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function isPortfolioViewerMember(member?: {
  role?: string | null;
  portfolioViewer?: boolean | null;
} | null) {
  const role = String(member?.role || "").toLowerCase();
  return role === "owner" || role === "admin" || Boolean(member?.portfolioViewer);
}

export function activeWorkspaceMemberId(workspaceId: string, userId: string) {
  return `${workspaceId}_${userId}`;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function buildOwnedAccessPatch({
  userId,
  email,
}: {
  userId: string;
  email?: string | null;
}) {
  const emailLower = normalizeAccessEmail(email);
  return {
    visibility: "private",
    visibleToUserIds: unique([userId]),
    visibleToEmails: unique([emailLower]),
  };
}

export function buildTaskAccessPatch({
  task,
  workspaceId,
  userId,
  email,
}: {
  task?: Record<string, unknown>;
  workspaceId: string;
  userId: string;
  email?: string | null;
}) {
  const assigneeIds = Array.isArray(task?.assigneeIds)
    ? (task?.assigneeIds as unknown[]).map((item) => String(item))
    : [];
  const explicitUserIds = Array.isArray(task?.visibleToUserIds)
    ? (task?.visibleToUserIds as unknown[]).map((item) => String(item))
    : [];
  const explicitEmails = Array.isArray(task?.visibleToEmails)
    ? (task?.visibleToEmails as unknown[]).map((item) => normalizeAccessEmail(String(item)))
    : [];
  const sharedWithUserIds = Array.isArray(task?.sharedWithUserIds)
    ? (task?.sharedWithUserIds as unknown[]).map((item) => String(item))
    : [];
  return {
    visibility: String(task?.visibility || "private"),
    visibleToUserIds: unique([userId, ...explicitUserIds, ...sharedWithUserIds]),
    visibleToEmails: unique([normalizeAccessEmail(email), ...explicitEmails]),
    sharedWithUserIds: unique(sharedWithUserIds),
    assigneeIds,
    accessMemberIds: unique([
      activeWorkspaceMemberId(workspaceId, userId),
      ...assigneeIds,
    ]),
  };
}

