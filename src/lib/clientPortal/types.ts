/**
 * Certo Work — Client Portal contracts (team source + projected views).
 * Portal reads only client_portal/{clientId}/… — never internal collections.
 */
import { z } from "zod";

export type PortalLocale = "es" | "en";
export type PortalMemberRole = "approver" | "viewer";
export type PortalMemberStatus = "invited" | "active" | "revoked";
export type DigestPref = "immediate" | "weekly";

export interface PortalBrand {
  name: string;
  logoUrl?: string;
  accent?: string;
}

export interface PortalSettings {
  updates: boolean;
  timeline: boolean;
  clientVisibleItems: boolean;
  requests: boolean;
  documents: boolean;
  invoices: boolean;
  teamContactIds: string[];
  askOdysseus: boolean;
  costDetail: boolean;
  csatAfterCheckpoint: boolean;
  autoPublishUpdates?: boolean;
  brand: PortalBrand;
}

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  domain?: string;
  locale: PortalLocale;
  projectIds: string[];
  primaryContactId?: string;
  portalEnabled: boolean;
  settings: PortalSettings;
  createdAt: string;
  updatedAt: string;
}

export interface PortalMemberNotificationPrefs {
  updates: boolean;
  approvals: boolean;
  requests: boolean;
  invoices: boolean;
  digest: DigestPref;
}

export interface PortalMember {
  uid: string;
  email: string;
  name: string;
  title?: string;
  workspaceId: string;
  clientIds: string[];
  role: PortalMemberRole;
  locale: PortalLocale;
  status: PortalMemberStatus;
  invitedBy: string;
  invitedAt: string;
  lastSeenAt?: string;
  notificationPrefs: PortalMemberNotificationPrefs;
}

export interface ProjectUpdatePeriod {
  from: string;
  to: string;
}

export interface ProjectUpdateNeedsClient {
  text: string;
  approvalId?: string;
}

export interface ProjectUpdate {
  id: string;
  workspaceId: string;
  projectId: string;
  clientId: string;
  period: ProjectUpdatePeriod;
  title: string;
  summary: string;
  done: string[];
  next: string[];
  needsClient: ProjectUpdateNeedsClient[];
  status: "draft" | "published" | "archived";
  source: "odysseus" | "manual";
  draftInputsHash?: string;
  authorUid: string;
  publishedAt?: string;
  publishedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type ClientApprovalKind =
  | "checkpoint"
  | "invoice"
  | "document"
  | "change_request"
  | "question";

export type ClientApprovalStatus = "pending" | "accepted" | "rejected" | "expired";

export interface ClientApprovalRefs {
  milestoneId?: string;
  invoiceId?: string;
  documentId?: string;
  taskId?: string;
}

export interface ClientApprovalReminder {
  at: string;
  channel: "email" | "portal";
}

export interface ClientApproval {
  id: string;
  workspaceId: string;
  projectId: string;
  clientId: string;
  kind: ClientApprovalKind;
  title: string;
  description?: string;
  refs: ClientApprovalRefs;
  requestedBy: string;
  requestedAt: string;
  dueAt?: string;
  status: ClientApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
  reminders: ClientApprovalReminder[];
}

/** Projected views under client_portal/{clientId}/… */

export interface ProjectViewPm {
  name: string;
  title?: string;
  avatar?: string;
}

export interface ProjectViewNextCheckpoint {
  title: string;
  date?: string;
  status: "done" | "current" | "upcoming" | "waiting_client";
}

export interface ProjectViewInvoiceSummary {
  pending: number;
  overdue: number;
}

export interface ProjectView {
  id: string;
  name: string;
  code?: string;
  health?: string;
  stage?: string;
  phase?: string;
  progressPct?: number;
  nextCheckpoint?: ProjectViewNextCheckpoint;
  pm?: ProjectViewPm;
  team: ProjectViewPm[];
  lastUpdateAt?: string;
  openRequests: number;
  docCount: number;
  invoiceSummary: ProjectViewInvoiceSummary;
  visibility: PortalSettings;
}

export interface UpdateViewAuthor {
  name: string;
  title?: string;
  avatar?: string;
}

export interface UpdateView {
  id: string;
  projectId: string;
  period: ProjectUpdatePeriod;
  title: string;
  summary: string;
  done: string[];
  next: string[];
  needsClient: ProjectUpdateNeedsClient[];
  author: UpdateViewAuthor;
  publishedAt: string;
}

export interface TimelineItem {
  id: string;
  title: string;
  date?: string;
  kind: "stage" | "checkpoint" | "milestone";
  status: "done" | "current" | "upcoming" | "waiting_client";
}

export interface TimelineView {
  projectId: string;
  items: TimelineItem[];
}

export interface ItemViewSla {
  dueAt?: string;
  breached?: boolean;
}

export interface ItemView {
  id: string;
  projectId: string;
  title: string;
  status: string;
  dueDate?: string;
  lastPublicUpdate?: string;
  kind: "work" | "request";
  requestNumber?: string;
  sla?: ItemViewSla;
}

export interface DocumentView {
  id: string;
  projectId: string;
  name: string;
  mime?: string;
  size?: number;
  /** Placeholder; real URL from getPortalDocumentUrl callable. */
  url?: string;
  publishedAt?: string;
  signed?: boolean;
}

export interface InvoiceView {
  id: string;
  projectId?: string;
  number: string;
  amount: number;
  currency: string;
  issueDate?: string;
  dueDate?: string;
  status: string;
  pdfUrl?: string;
  paymentStatus?: string;
  paymentLink?: string;
  approvedAt?: string;
}

export interface ApprovalView {
  id: string;
  projectId: string;
  kind: ClientApprovalKind;
  title: string;
  description?: string;
  dueAt?: string;
  status: ClientApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
  requestedAt: string;
}

export interface ThreadView {
  id: string;
  projectId?: string;
  subject: string;
  lastMessageAt?: string;
  unread: Record<string, number>;
}

export type ActivityKind =
  | "update"
  | "request"
  | "document"
  | "invoice"
  | "approval"
  | "message";

export interface ActivityView {
  id: string;
  at: string;
  kind: ActivityKind;
  title: string;
  body?: string;
  projectId?: string;
  actor?: { name: string; avatar?: string };
}

export interface CsatView {
  id: string;
  projectId: string;
  checkpointId: string;
  score?: number;
  comment?: string;
  askedAt: string;
  answeredAt?: string;
}

export interface PortalMeta {
  brand: PortalBrand;
  nav: {
    home: number;
    projects: number;
    requests: number;
    invoices: number;
    documents: number;
    messages: number;
    approvals: number;
  };
  locale: PortalLocale;
}

export type PortalEventKind =
  | "view_update"
  | "view_project"
  | "download"
  | "approve"
  | "reject"
  | "request_created"
  | "message"
  | "csat"
  | "ask";

export interface PortalEvent {
  id: string;
  clientId: string;
  uid: string;
  at: string;
  kind: PortalEventKind;
  refId?: string;
  meta?: Record<string, unknown>;
}

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  updates: true,
  timeline: true,
  clientVisibleItems: true,
  requests: true,
  documents: true,
  invoices: true,
  teamContactIds: [],
  askOdysseus: true,
  costDetail: false,
  csatAfterCheckpoint: true,
  autoPublishUpdates: false,
  brand: { name: "Client portal" },
};

export const DEFAULT_NOTIFICATION_PREFS: PortalMemberNotificationPrefs = {
  updates: true,
  approvals: true,
  requests: true,
  invoices: true,
  digest: "immediate",
};

/* —— Zod (strict) for projection writes —— */

const brandZ = z
  .object({
    name: z.string(),
    logoUrl: z.string().optional(),
    accent: z.string().optional(),
  })
  .strict();

export const portalSettingsZ = z
  .object({
    updates: z.boolean(),
    timeline: z.boolean(),
    clientVisibleItems: z.boolean(),
    requests: z.boolean(),
    documents: z.boolean(),
    invoices: z.boolean(),
    teamContactIds: z.array(z.string()),
    askOdysseus: z.boolean(),
    costDetail: z.boolean(),
    csatAfterCheckpoint: z.boolean(),
    autoPublishUpdates: z.boolean().optional(),
    brand: brandZ,
  })
  .strict();

const pmZ = z
  .object({
    name: z.string(),
    title: z.string().optional(),
    avatar: z.string().optional(),
  })
  .strict();

const nextCheckpointZ = z
  .object({
    title: z.string(),
    date: z.string().optional(),
    status: z.enum(["done", "current", "upcoming", "waiting_client"]),
  })
  .strict();

export const projectViewZ = z
  .object({
    id: z.string(),
    name: z.string(),
    code: z.string().optional(),
    health: z.string().optional(),
    stage: z.string().optional(),
    phase: z.string().optional(),
    progressPct: z.number().optional(),
    nextCheckpoint: nextCheckpointZ.optional(),
    pm: pmZ.optional(),
    team: z.array(pmZ),
    lastUpdateAt: z.string().optional(),
    openRequests: z.number(),
    docCount: z.number(),
    invoiceSummary: z
      .object({ pending: z.number(), overdue: z.number() })
      .strict(),
    visibility: portalSettingsZ,
  })
  .strict();

export const updateViewZ = z
  .object({
    id: z.string(),
    projectId: z.string(),
    period: z.object({ from: z.string(), to: z.string() }).strict(),
    title: z.string(),
    summary: z.string(),
    done: z.array(z.string()),
    next: z.array(z.string()),
    needsClient: z.array(
      z.object({ text: z.string(), approvalId: z.string().optional() }).strict(),
    ),
    author: pmZ,
    publishedAt: z.string(),
  })
  .strict();

export const timelineViewZ = z
  .object({
    projectId: z.string(),
    items: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          date: z.string().optional(),
          kind: z.enum(["stage", "checkpoint", "milestone"]),
          status: z.enum(["done", "current", "upcoming", "waiting_client"]),
        })
        .strict(),
    ),
  })
  .strict();

export const itemViewZ = z
  .object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    status: z.string(),
    dueDate: z.string().optional(),
    lastPublicUpdate: z.string().optional(),
    kind: z.enum(["work", "request"]),
    requestNumber: z.string().optional(),
    sla: z
      .object({ dueAt: z.string().optional(), breached: z.boolean().optional() })
      .strict()
      .optional(),
  })
  .strict();

export const documentViewZ = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    mime: z.string().optional(),
    size: z.number().optional(),
    url: z.string().optional(),
    publishedAt: z.string().optional(),
    signed: z.boolean().optional(),
  })
  .strict();

export const invoiceViewZ = z
  .object({
    id: z.string(),
    projectId: z.string().optional(),
    number: z.string(),
    amount: z.number(),
    currency: z.string(),
    issueDate: z.string().optional(),
    dueDate: z.string().optional(),
    status: z.string(),
    pdfUrl: z.string().optional(),
    paymentStatus: z.string().optional(),
    paymentLink: z.string().optional(),
    approvedAt: z.string().optional(),
  })
  .strict();

export const approvalViewZ = z
  .object({
    id: z.string(),
    projectId: z.string(),
    kind: z.enum([
      "checkpoint",
      "invoice",
      "document",
      "change_request",
      "question",
    ]),
    title: z.string(),
    description: z.string().optional(),
    dueAt: z.string().optional(),
    status: z.enum(["pending", "accepted", "rejected", "expired"]),
    decidedBy: z.string().optional(),
    decidedAt: z.string().optional(),
    comment: z.string().optional(),
    requestedAt: z.string(),
  })
  .strict();

export const threadViewZ = z
  .object({
    id: z.string(),
    projectId: z.string().optional(),
    subject: z.string(),
    lastMessageAt: z.string().optional(),
    unread: z.record(z.string(), z.number()),
  })
  .strict();

export const activityViewZ = z
  .object({
    id: z.string(),
    at: z.string(),
    kind: z.enum([
      "update",
      "request",
      "document",
      "invoice",
      "approval",
      "message",
    ]),
    title: z.string(),
    body: z.string().optional(),
    projectId: z.string().optional(),
    actor: z
      .object({ name: z.string(), avatar: z.string().optional() })
      .strict()
      .optional(),
  })
  .strict();

export const csatViewZ = z
  .object({
    id: z.string(),
    projectId: z.string(),
    checkpointId: z.string(),
    score: z.number().optional(),
    comment: z.string().optional(),
    askedAt: z.string(),
    answeredAt: z.string().optional(),
  })
  .strict();

export const portalMetaZ = z
  .object({
    brand: brandZ,
    nav: z
      .object({
        home: z.number(),
        projects: z.number(),
        requests: z.number(),
        invoices: z.number(),
        documents: z.number(),
        messages: z.number(),
        approvals: z.number(),
      })
      .strict(),
    locale: z.enum(["es", "en"]),
  })
  .strict();

export function parseStrict<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
