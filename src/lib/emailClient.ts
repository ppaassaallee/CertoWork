type WorkspaceInviteEmailRequest = {
  token: string;
  userId: string;
  workspaceId: string;
  workspaceName: string;
  toEmail: string;
  role: string;
  inviterName?: string | null;
  inviterEmail?: string | null;
};

export type WorkspaceInviteEmailResult = {
  sent?: boolean;
  configured?: boolean;
  messageId?: string;
  error?: string;
};

export async function sendWorkspaceInviteEmail({
  token,
  userId,
  workspaceId,
  workspaceName,
  toEmail,
  role,
  inviterName,
  inviterEmail,
}: WorkspaceInviteEmailRequest): Promise<WorkspaceInviteEmailResult> {
  const response = await fetch("/api/email/invite", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      workspaceId,
      workspaceName,
      toEmail,
      role,
      inviterName,
      inviterEmail,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      sent: false,
      configured: true,
      error: result.error || "Invite email could not be sent.",
    };
  }
  return result;
}
