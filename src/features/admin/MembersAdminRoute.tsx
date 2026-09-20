import { useMemo } from "react";
import { MembersAdminPage, type MemberRow } from "./MembersAdminPage";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";

export function MembersAdminRoute({
  members,
  inviteLink,
  onInviteEmail,
  onChangeRole,
}: {
  members: WorkspaceMember[];
  inviteLink?: string;
  onInviteEmail?: (email: string) => Promise<void> | void;
  onChangeRole?: (id: string, role: string) => Promise<void> | void;
}) {
  const rows: MemberRow[] = useMemo(
    () =>
      members.map((m) => ({
        id: m.id,
        name: m.displayName || m.alias || m.email || m.id,
        email: m.email || "",
        role: String(m.role || "member"),
        status: m.status || "Offline",
      })),
    [members],
  );
  return (
    <MembersAdminPage
      inviteLink={inviteLink}
      members={rows}
      onChangeRole={onChangeRole}
      onInviteEmail={onInviteEmail}
    />
  );
}
