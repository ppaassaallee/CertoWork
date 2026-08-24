export const PROJECT_STATUSES = [
  "idea",
  "planning",
  "active",
  "paused",
  "completed",
  "archived",
] as const;

export const PROJECT_HEALTH = ["on_track", "at_risk", "blocked"] as const;
export const TASK_STATUSES = ["open", "in_progress", "blocked", "done"] as const;
export const APPROVAL_STATUSES = [
  "pending",
  "approved_for_review",
  "approved",
  "rejected",
] as const;
export const MEMBER_ROLES = ["owner", "admin", "member", "viewer"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectHealth = (typeof PROJECT_HEALTH)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type MemberRole = (typeof MEMBER_ROLES)[number];

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole | string;
  status: "active" | "pending" | "disabled" | string;
  email?: string;
  emailLower?: string;
  displayName?: string;
  alias?: string;
  portfolioViewer?: boolean;
  financeAccess?: boolean;
};

export type Project = {
  id: string;
  workspaceId: string;
  userId?: string;
  ownerId?: string;
  title?: string;
  name?: string;
  status?: ProjectStatus | string;
  health?: ProjectHealth | string;
  healthOverride?: ProjectHealth | string | null;
  dueDate?: string | null;
};

export type Task = {
  id: string;
  workspaceId: string;
  projectId?: string;
  userId?: string;
  title?: string;
  status?: TaskStatus | string;
  dueDate?: string | null;
  priority?: string | null;
};

export type Milestone = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  status?: string;
  dueDate?: string | null;
};

export type Risk = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  severity?: string;
  status?: string;
};

export type Approval = {
  id: string;
  workspaceId: string;
  status: ApprovalStatus | string;
  type?: string;
  createdAt?: unknown;
};
