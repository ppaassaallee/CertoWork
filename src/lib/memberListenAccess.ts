export type MembershipListenRow = {
  userId?: string | null;
  status?: string | null;
};

/**
 * Matches isWorkspaceMember: an active or accepted workspace_members doc.
 * Owner-only and email-on-workspace.members are not enough for list rules.
 */
export function isJoinedWorkspaceMember(
  userId: string | null | undefined,
  members: readonly MembershipListenRow[] | null | undefined,
) {
  const uid = String(userId || "").trim();
  if (!uid) return false;
  return (members || []).some((member) => {
    if (String(member?.userId || "") !== uid) return false;
    const status = String(member?.status || "").toLowerCase();
    return status === "active" || status === "accepted";
  });
}
