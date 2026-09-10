export const INVITE_TTL_DAYS = 7;
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Reminder cadence from invite creation (best practice: day 1 / 3 / 6, expire day 7). */
export const INVITE_REMINDER_SCHEDULE = [
  { step: 1, delayMs: 1 * 24 * 60 * 60 * 1000, kind: "reminder_1" as const },
  { step: 2, delayMs: 3 * 24 * 60 * 60 * 1000, kind: "reminder_2" as const },
  { step: 3, delayMs: 6 * 24 * 60 * 60 * 1000, kind: "reminder_final" as const },
];

export type InviteEmailKind = "invite" | "reminder_1" | "reminder_2" | "reminder_final";

export function inviteActivationPath(token?: string | null) {
  const value = String(token || "").trim();
  return value ? `/invite/${encodeURIComponent(value)}` : "/";
}

export function inviteDirectoryUrl(token?: string | null, origin = "https://certo.work") {
  const path = inviteActivationPath(token);
  return path === "/" ? origin : `${origin}${path}`;
}

export function inviteExpiresAt(from = Date.now()) {
  return new Date(from + INVITE_TTL_MS);
}

export function inviteExpiresLabel(expiresAt: Date | number | string | null | undefined, locale = "en") {
  const millis = asMillis(expiresAt);
  if (!millis) return "";
  try {
    return new Date(millis).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return new Date(millis).toISOString().slice(0, 10);
  }
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
  return now - created > INVITE_TTL_MS;
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

export function inviteCreatedAtMs(invite: { createdAt?: any; emailSentAt?: any } | null | undefined) {
  return asMillis(invite?.createdAt) || asMillis(invite?.emailSentAt) || 0;
}

export function nextInviteReminder(
  invite: {
    createdAt?: any;
    emailSentAt?: any;
    reminderCount?: number | string | null;
    nextReminderAt?: any;
  } | null | undefined,
  now = Date.now(),
): { step: number; kind: InviteEmailKind; dueAt: number } | null {
  if (!invite || inviteIsExpired(invite, now)) return null;
  const created = inviteCreatedAtMs(invite);
  if (!created) return null;
  const completed = Math.max(0, Number(invite.reminderCount || 0) || 0);
  const next = INVITE_REMINDER_SCHEDULE.find((item) => item.step > completed);
  if (!next) return null;
  const dueAt = created + next.delayMs;
  return { step: next.step, kind: next.kind, dueAt };
}

export function dueInviteReminder(
  invite: {
    status?: string;
    createdAt?: any;
    emailSentAt?: any;
    reminderCount?: number | string | null;
    nextReminderAt?: any;
    emailDeliveryStatus?: string | null;
  } | null | undefined,
  now = Date.now(),
): { step: number; kind: InviteEmailKind; dueAt: number } | null {
  if (!invite || !inviteIsUsable(invite) || inviteIsExpired(invite, now)) return null;
  const delivery = String(invite.emailDeliveryStatus || "").toLowerCase();
  if (!["sent", "delivered", "opened"].includes(delivery)) {
    // Don't auto-remind when the first email never left the provider.
    return null;
  }
  const scheduled = nextInviteReminder(invite, now);
  if (!scheduled) return null;
  const forcedNext = asMillis(invite.nextReminderAt);
  const dueAt = forcedNext || scheduled.dueAt;
  if (dueAt > now) return null;
  return { ...scheduled, dueAt };
}

/** Retry the first invite email when Brevo was down / misconfigured briefly. */
export function dueInviteEmailRetry(
  invite: {
    status?: string;
    createdAt?: any;
    emailSentAt?: any;
    emailDeliveryStatus?: string | null;
    emailRetryCount?: number | string | null;
    lastEmailError?: string | null;
  } | null | undefined,
  now = Date.now(),
): { kind: InviteEmailKind; retryCount: number } | null {
  if (!invite || !inviteIsUsable(invite) || inviteIsExpired(invite, now)) return null;
  const delivery = String(invite.emailDeliveryStatus || "").toLowerCase();
  if (["sent", "delivered", "opened"].includes(delivery)) return null;
  const created = inviteCreatedAtMs(invite);
  if (!created) return null;
  // Give the first send a moment, then retry up to 5 times (about every few minutes via the client loop).
  if (now - created < 90_000) return null;
  const retries = Math.max(0, Number(invite.emailRetryCount || 0) || 0);
  if (retries >= 5) return null;
  return { kind: "invite", retryCount: retries };
}

export function reminderScheduleAfterSend(
  invite: { createdAt?: any; emailSentAt?: any; reminderCount?: number | string | null } | null | undefined,
  kind: InviteEmailKind = "invite",
  now = Date.now(),
) {
  const completed =
    kind === "invite"
      ? 0
      : kind === "reminder_1"
        ? 1
        : kind === "reminder_2"
          ? 2
          : 3;
  const created = inviteCreatedAtMs(invite) || now;
  const next = INVITE_REMINDER_SCHEDULE.find((item) => item.step > completed);
  return {
    reminderCount: completed,
    lastEmailKind: kind,
    nextReminderAt: next ? new Date(created + next.delayMs) : null,
  };
}

export function inviteDeliveryLabel(status?: string | null, error?: string | null) {
  const value = String(status || "").toLowerCase();
  if (value === "delivered") return "delivered to inbox";
  if (value === "opened") return "opened";
  if (value === "sent") return "accepted by mail provider";
  if (value === "bounced") return error ? `bounced (${error})` : "bounced";
  if (value === "failed") return error ? `failed (${error})` : "failed";
  if (value === "not_sent") return error ? `not sent (${error})` : "not sent";
  if (!value) return "email not sent yet";
  return value.replace(/_/g, " ");
}
