export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type WorkspaceMember = {
  id: string;
  workspaceId?: string;
  userId?: string;
  email?: string;
  emailLower?: string;
  displayName?: string;
  role?: WorkspaceRole | string;
  status?: string;
  teamIds?: string[];
};

export type WorkspaceTeam = {
  id: string;
  workspaceId?: string;
  name?: string;
  description?: string;
  memberEmails?: string[];
  status?: string;
};

export const WORKSPACE_LIMIT = 3;

export const WORKSPACE_ROLES: Array<{ value: WorkspaceRole; label: string; help: string }> = [
  { value: "admin", label: "Admin", help: "Can manage workspace setup and most work." },
  { value: "member", label: "Member", help: "Can collaborate on projects and tasks." },
  { value: "viewer", label: "Viewer", help: "Can follow work with limited changes." },
];

export function canCreateWorkspace(count: number) {
  return count < WORKSPACE_LIMIT;
}

export function normalizeInviteEmail(value: string) {
  return value.trim().toLowerCase();
}

export function memberLabel(member: Pick<WorkspaceMember, "displayName" | "email">) {
  return member.displayName?.trim() || member.email?.trim() || "Unnamed member";
}

export function memberAssignmentValue(member: Pick<WorkspaceMember, "displayName" | "email">) {
  return member.displayName?.trim() || member.email?.trim() || "";
}

export function roleLabel(value?: string) {
  const role = String(value || "member").toLowerCase();
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "viewer") return "Viewer";
  return "Member";
}

export function createInviteCode() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().slice(0, 8).toUpperCase();
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}
