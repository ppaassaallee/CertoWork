export function inviteActivationPath(token?: string | null) {
  const value = String(token || "").trim();
  return value ? `/invite/${encodeURIComponent(value)}` : "/";
}

export function inviteDirectoryUrl(token?: string | null, origin = "https://certo.work") {
  const path = inviteActivationPath(token);
  return path === "/" ? origin : `${origin}${path}`;
}

function asMillis(value: any) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function inviteIsExpired(invite: { createdAt?: any; expiresAt?: any } | null | undefined, now = Date.now()) {
  if (!invite) return false;
  const expires = asMillis(invite.expiresAt);
  if (expires && expires < now) return true;
  const created = asMillis(invite.createdAt);
  if (!created) return false;
  return now - created > 14 * 24 * 60 * 60 * 1000;
}

export function inviteStatus(invite: { status?: string } | null | undefined) {
  return String(invite?.status || "pending").toLowerCase();
}

export function inviteIsUsable(invite: { status?: string } | null | undefined) {
  return ["pending", "sent", "invited"].includes(inviteStatus(invite));
}

export function inviteWasConsumed(invite: { status?: string } | null | undefined) {
  return ["accepted", "revoked", "rejected"].includes(inviteStatus(invite));
}

export function inviteShouldCloseOnJoin(
  invite: { status?: string; inviteType?: string; workspaceId?: string } | null | undefined,
  workspaceId: string,
) {
  if (!invite || !workspaceId) return false;
  if (invite.workspaceId && String(invite.workspaceId) !== workspaceId) return false;
  if (invite.inviteType && String(invite.inviteType) !== "workspace_member") return false;
  return inviteIsUsable(invite);
}
