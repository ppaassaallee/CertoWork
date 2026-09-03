/** Certo Capture + Requests (Tickets) — shared domain helpers. */

export const CAPTURE_INTENTS = [
  "ACTION_REQUIRED",
  "FYI",
  "DECISION",
  "FOLLOW_UP",
  "REQUEST",
  "MEETING",
  "INFORMATION",
  "SPAM",
  "NO_ACTION",
] as const;
export type CaptureIntent = (typeof CAPTURE_INTENTS)[number];

export const TICKET_STATUSES = [
  "new",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const WAITING_REASONS = [
  "Waiting for requester",
  "Waiting for vendor",
  "Waiting for engineering",
  "Waiting for approval",
  "Waiting for information",
] as const;

export const MESSAGE_VISIBILITIES = ["public", "internal"] as const;
export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export const CAPTURE_SOURCE_TYPES = [
  "email",
  "form",
  "manual",
  "api",
  "meeting",
  "slack",
  "teams",
  "agent",
  "ticket",
  "integration",
] as const;
export type CaptureSourceType = (typeof CAPTURE_SOURCE_TYPES)[number];

export type ConfidenceBand = "high" | "medium" | "low";

export type AiFieldGuess<T = string> = {
  value: T | null;
  confidence: number;
};

export type CaptureUnderstandResult = {
  intent: CaptureIntent;
  title: string;
  description: {
    context: string;
    outcome: string;
    details: string;
  };
  workItemSuggestion: "pbi" | "ticket" | "none";
  fields: {
    projectId?: AiFieldGuess;
    dueDate?: AiFieldGuess;
    priority?: AiFieldGuess;
    owner?: AiFieldGuess;
    team?: AiFieldGuess;
  };
  duplicateOfId?: string | null;
};

export type CaptureAddress = {
  id: string;
  workspaceId: string;
  kind: "personal" | "team";
  localPart: string;
  domain: string;
  email: string;
  userId?: string | null;
  teamId?: string | null;
  teamSlug?: string | null;
  status?: "active" | "revoked";
  secretSuffix?: string | null;
  createdAt?: unknown;
};

export type WorkItemMessage = {
  id: string;
  workspaceId: string;
  workItemId: string;
  visibility: MessageVisibility;
  channel: "app" | "email" | "system";
  body: string;
  authorId?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  createdAt?: unknown;
};

const ACTIONABLE_INTENTS = new Set<CaptureIntent>([
  "ACTION_REQUIRED",
  "DECISION",
  "FOLLOW_UP",
  "REQUEST",
]);

export function isCaptureIntent(value?: string | null): value is CaptureIntent {
  return CAPTURE_INTENTS.includes(String(value || "") as CaptureIntent);
}

export function isTicketStatus(value?: string | null): value is TicketStatus {
  return TICKET_STATUSES.includes(String(value || "") as TicketStatus);
}

export function confidenceBand(score?: number | null): ConfidenceBand {
  const value = Number(score);
  if (!Number.isFinite(value)) return "low";
  if (value >= 0.85) return "high";
  if (value >= 0.55) return "medium";
  return "low";
}

export function shouldAutoAssignField(score?: number | null) {
  return confidenceBand(score) === "high";
}

export function shouldSuggestField(score?: number | null) {
  return confidenceBand(score) === "medium";
}

export function isActionableCaptureIntent(intent?: string | null) {
  return ACTIONABLE_INTENTS.has(String(intent || "") as CaptureIntent);
}

export function normalizeLocalPart(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 64);
}

export function buildPersonalCaptureEmail(username: string, domain = "in.certo.work") {
  const local = normalizeLocalPart(username);
  return local ? `${local}@${domain}` : "";
}

export function buildPersonalCaptureAlias(username: string, suffix: string, domain = "in.certo.work") {
  const local = normalizeLocalPart(username);
  const token = normalizeLocalPart(suffix).slice(0, 8);
  if (!local || !token) return "";
  return `${local}.${token}@${domain}`;
}

export function buildTeamCaptureEmail(teamSlug: string, domain = "requests.certo.work") {
  const local = normalizeLocalPart(teamSlug);
  return local ? `${local}@${domain}` : "";
}

export function parseCaptureRecipient(address: string) {
  const email = String(address || "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  return {
    email,
    localPart: email.slice(0, at),
    domain: email.slice(at + 1),
  };
}

/** Stable thread key from Message-ID / In-Reply-To / References. */
export function emailThreadKey(input: {
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string | string[] | null;
  fallbackSubject?: string | null;
  fallbackParticipants?: string[] | null;
}) {
  const refs = Array.isArray(input.references)
    ? input.references
    : String(input.references || "")
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
  const seed =
    String(input.inReplyTo || "").trim() ||
    refs[0] ||
    String(input.messageId || "").trim();
  if (seed) return `msgid:${seed.replace(/^<|>$/g, "").toLowerCase()}`;
  const subject = String(input.fallbackSubject || "")
    .replace(/^(re|fw|fwd)\s*:\s*/gi, "")
    .trim()
    .toLowerCase();
  const people = (input.fallbackParticipants || [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
  if (subject && people) return `subj:${subject}|${people}`;
  return "";
}

export function stripQuotedEmailReply(body: string) {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const patterns = [
    /\nOn .+ wrote:\n[\s\S]*$/i,
    /\nFrom:\s.+\nSent:\s.+\n[\s\S]*$/i,
    /\n-{2,}\s*Original Message\s*-{2,}[\s\S]*$/i,
    /\n>{1,}.*$/m,
  ];
  let cleaned = text;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n")
    .trim();
}

export function sanitizeEmailHtmlToText(html: string) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCaptureDescription(parts: {
  context?: string;
  outcome?: string;
  details?: string;
  sourceLabel?: string;
}) {
  const blocks = [
    parts.context ? `Context\n${parts.context.trim()}` : "",
    parts.outcome ? `Requested outcome\n${parts.outcome.trim()}` : "",
    parts.details ? `Important details\n${parts.details.trim()}` : "",
    parts.sourceLabel ? `Source\n${parts.sourceLabel.trim()}` : "",
  ].filter(Boolean);
  return blocks.join("\n\n");
}

export function ticketStatusLabel(status?: string | null) {
  const value = String(status || "new").toLowerCase();
  if (value === "in_progress") return "In progress";
  if (value === "waiting") return "Waiting";
  if (value === "resolved") return "Resolved";
  if (value === "closed") return "Closed";
  return "New";
}

/** Customer-facing status — never leak eng IDs. */
export function toCustomerStatus(ticket: {
  ticketStatus?: string | null;
  status?: string | null;
  customerStatus?: string | null;
  waitingReason?: string | null;
}) {
  if (ticket.customerStatus) return String(ticket.customerStatus);
  const status = String(ticket.ticketStatus || ticket.status || "new").toLowerCase();
  if (status === "new") return "Received";
  if (status === "in_progress") return "In progress";
  if (status === "waiting") {
    return ticket.waitingReason === "Waiting for requester"
      ? "Waiting on you"
      : "Waiting on our side";
  }
  if (status === "resolved") return "Resolved";
  if (status === "closed") return "Closed";
  return "Update coming soon";
}

export function mapTicketStatusToWorkStatus(ticketStatus: TicketStatus | string) {
  const value = String(ticketStatus || "new").toLowerCase();
  if (value === "in_progress") return "in_progress";
  if (value === "waiting") return "blocked";
  if (value === "resolved" || value === "closed" || value === "done") return "done";
  return "backlog";
}

export function isCapturedWorkItem(item: Record<string, unknown> | null | undefined) {
  if (!item) return false;
  const source = String(item.source || item.sourceType || "").toLowerCase();
  return ["email", "capture", "form", "meeting", "slack", "teams", "agent"].includes(source)
    || Boolean(item.sourceThreadId || item.sourceId || item.captureChannelId);
}

export function needsCaptureReview(item: Record<string, unknown> | null | undefined) {
  if (!item) return false;
  const intent = String((item.ai as any)?.classification || item.captureIntent || "");
  if (!isActionableCaptureIntent(intent) && intent) return true;
  return String(item.captureReviewStatus || "") === "needs_review";
}

export function publicTicketProjection(ticket: Record<string, unknown>) {
  return {
    id: ticket.id,
    key: ticket.key || null,
    title: ticket.title || "",
    description: String(ticket.description || "").slice(0, 4000),
    customerStatus: toCustomerStatus(ticket as any),
    customerStatusDetail: ticket.customerStatusDetail || null,
    requesterEmail: ticket.requesterEmail || null,
    requesterName: ticket.requesterName || null,
    createdAt: ticket.createdAt || null,
    updatedAt: ticket.updatedAt || null,
    lastPublicUpdate: ticket.lastPublicUpdate || null,
    nextExpectedUpdate: (ticket.sla as any)?.nextUpdateDueAt || null,
  };
}

export const REQUEST_PORTAL_COLLECTION = "request_portal_tokens";

export type RequestPortalMessage = {
  id: string;
  body: string;
  authorName?: string | null;
  authorRole: "requester" | "team";
  createdAt?: unknown;
};

export type RequestPortalSnapshot = {
  workspaceName: string;
  ticket: ReturnType<typeof publicTicketProjection>;
  messages: RequestPortalMessage[];
  updatedAt: number;
};

export function createRequestPortalToken() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function requestPortalPath(token: string) {
  return `/request/${encodeURIComponent(token)}`;
}

export function requestPortalAbsoluteUrl(token: string, origin?: string) {
  const base = String(origin || (typeof window !== "undefined" ? window.location.origin : "https://certo.work"))
    .replace(/\/$/, "");
  return `${base}${requestPortalPath(token)}`;
}

export function publicMessagesForPortal(
  messages: Array<Record<string, unknown>> = [],
  ticketId: string,
): RequestPortalMessage[] {
  return messages
    .filter(
      (message) =>
        String(message.workItemId || "") === ticketId &&
        String(message.visibility || "public") === "public",
    )
    .map((message) => ({
      id: String(message.id || ""),
      body: String(message.body || ""),
      authorName: (message.authorName as string) || null,
      authorRole:
        String(message.channel || "") === "portal" ||
        String(message.authorRole || "") === "requester"
          ? ("requester" as const)
          : ("team" as const),
      createdAt: message.createdAt || null,
    }));
}

export function buildRequestPortalSnapshot(input: {
  workspaceName: string;
  ticket: Record<string, unknown>;
  messages?: Array<Record<string, unknown>>;
}): RequestPortalSnapshot {
  const ticketId = String(input.ticket.id || "");
  return {
    workspaceName: String(input.workspaceName || "Certo Work"),
    ticket: publicTicketProjection(input.ticket),
    messages: publicMessagesForPortal(input.messages || [], ticketId),
    updatedAt: Date.now(),
  };
}

/** Minimal SLA clocks for Requests — first response + next update. */
export function buildTicketSlaPatch(now = Date.now()) {
  const hour = 60 * 60 * 1000;
  return {
    firstResponseDueAt: new Date(now + 8 * hour).toISOString(),
    resolutionDueAt: new Date(now + 72 * hour).toISOString(),
    nextUpdateDueAt: new Date(now + 24 * hour).toISOString(),
    firstRespondedAt: null as string | null,
  };
}

export function markTicketFirstResponseSla(
  existing: Record<string, unknown> | null | undefined,
  now = Date.now(),
) {
  const current = (existing?.sla && typeof existing.sla === "object"
    ? { ...(existing.sla as Record<string, unknown>) }
    : buildTicketSlaPatch(now)) as Record<string, unknown>;
  if (!current.firstRespondedAt) {
    current.firstRespondedAt = new Date(now).toISOString();
  }
  current.nextUpdateDueAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  return current;
}

export function captureRouteDocId(email: string) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, "_")
    .slice(0, 700);
}

/** Deterministic offline AI fallback when OpenAI is unavailable. */
export function deterministicCaptureUnderstand(input: {
  subject?: string;
  body?: string;
  fromName?: string;
  fromEmail?: string;
}): CaptureUnderstandResult {
  const subject = String(input.subject || "").trim();
  const body = stripQuotedEmailReply(String(input.body || ""));
  const text = `${subject}\n${body}`.toLowerCase();
  let intent: CaptureIntent = "INFORMATION";
  if (/unsubscribe|viagra|crypto giveaway/.test(text)) intent = "SPAM";
  else if (/\b(fyi|for your information|no action)\b/.test(text)) intent = "FYI";
  else if (/\b(meeting|invite|calendar)\b/.test(text)) intent = "MEETING";
  else if (/\b(decide|decision|approve|approval)\b/.test(text)) intent = "DECISION";
  else if (/\b(follow[- ]?up|checking in|circling back)\b/.test(text)) intent = "FOLLOW_UP";
  else if (/\b(please|need|request|can you|could you|asap|by friday|deadline)\b/.test(text)) {
    intent = "ACTION_REQUIRED";
  } else if (!subject && !body) intent = "NO_ACTION";

  const cleanedTitle = subject
    .replace(/^(re|fw|fwd)\s*:\s*/gi, "")
    .replace(/\bfinal\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const title =
    intent === "ACTION_REQUIRED" || intent === "DECISION"
      ? cleanedTitle
        ? cleanedTitle.length > 72
          ? `Review: ${cleanedTitle.slice(0, 64)}…`
          : cleanedTitle
        : "Review inbound request"
      : cleanedTitle || "Captured email";

  const context = body.slice(0, 420) || "No body text was provided.";
  const outcome =
    intent === "ACTION_REQUIRED" || intent === "FOLLOW_UP" || intent === "DECISION"
      ? "Confirm the requested outcome and close the loop with the sender."
      : "Review and decide whether action is required.";

  return {
    intent,
    title,
    description: {
      context,
      outcome,
      details: body.slice(0, 900),
    },
    workItemSuggestion: isActionableCaptureIntent(intent) ? "pbi" : "none",
    fields: {},
    duplicateOfId: null,
  };
}

export function deterministicTicketTriage(input: {
  subject?: string;
  body?: string;
}) {
  const text = `${input.subject || ""}\n${input.body || ""}`.toLowerCase();
  let priority: "1" | "2" | "3" = "2";
  if (/\b(down|outage|can't login|cannot access|production|critical|urgent)\b/.test(text)) {
    priority = "1";
  } else if (/\b(minor|cosmetic|when you can|low priority)\b/.test(text)) {
    priority = "3";
  }
  return {
    category: /\b(access|login|password|permission)\b/.test(text)
      ? "access"
      : /\b(report|dashboard|export)\b/.test(text)
        ? "reporting"
        : "general",
    priority,
    urgency: priority === "1" ? "high" : priority === "3" ? "low" : "normal",
    impact: priority === "1" ? "high" : "medium",
    suggestedOwner: null as string | null,
    duplicateOfId: null as string | null,
  };
}
