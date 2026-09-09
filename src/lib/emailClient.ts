type WorkspaceInviteEmailRequest = {
  token: string;
  userId: string;
  workspaceId: string;
  workspaceName: string;
  toEmail: string;
  role: string;
  inviterName?: string | null;
  inviterEmail?: string | null;
  inviteToken?: string | null;
  kind?: "invite" | "reminder_1" | "reminder_2" | "reminder_final" | string | null;
  expiresLabel?: string | null;
};

export type WorkspaceInviteEmailResult = {
  sent?: boolean;
  configured?: boolean;
  messageId?: string;
  inviteUrl?: string;
  kind?: string;
  error?: string;
};

export type WorkspaceInviteDeliveryResult = {
  configured?: boolean;
  status?: string;
  events?: Array<{ event?: string; date?: string; reason?: string; messageId?: string }>;
  messageId?: string;
  error?: string;
};

async function readJsonSafe(response: Response) {
  return response.json().catch(() => ({}));
}

export async function sendWorkspaceInviteEmail({
  token,
  userId,
  workspaceId,
  workspaceName,
  toEmail,
  role,
  inviterName,
  inviterEmail,
  inviteToken,
  kind = "invite",
  expiresLabel,
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
      inviteToken,
      kind,
      expiresLabel,
    }),
  });
  const result = (await readJsonSafe(response)) as WorkspaceInviteEmailResult;
  if (!response.ok) {
    return {
      sent: false,
      configured: result.configured !== false,
      messageId: result.messageId,
      inviteUrl: result.inviteUrl,
      kind: result.kind,
      error: result.error || "Invite email could not be sent.",
    };
  }
  return result;
}

export async function checkWorkspaceInviteDelivery({
  token,
  userId,
  workspaceId,
  toEmail,
  messageId,
}: {
  token: string;
  userId: string;
  workspaceId: string;
  toEmail?: string | null;
  messageId?: string | null;
}): Promise<WorkspaceInviteDeliveryResult> {
  const response = await fetch("/api/email/invite/delivery", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      workspaceId,
      toEmail,
      messageId,
    }),
  });
  const result = (await readJsonSafe(response)) as WorkspaceInviteDeliveryResult;
  if (!response.ok) {
    return {
      configured: result.configured !== false,
      status: "unknown",
      error: result.error || "Delivery status could not be checked.",
      messageId: messageId || undefined,
      events: result.events || [],
    };
  }
  return result;
}
