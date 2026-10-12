/** Shared owner/admin check for workspace maintenance callables. */
export function isWorkspaceOwnerOrAdmin(input: { isOwner?: boolean; role?: unknown }) {
  if (input.isOwner) return true;
  const role = String(input.role || "").toLowerCase();
  return role === "owner" || role === "admin";
}
