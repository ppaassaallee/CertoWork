import { z } from "zod";

/** Minimal strict schemas mirrored for Cloud Functions (separate package). */

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
    brand: z
      .object({
        name: z.string(),
        logoUrl: z.string().optional(),
        accent: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const pmZ = z
  .object({
    name: z.string(),
    title: z.string().optional(),
    avatar: z.string().optional(),
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
    nextCheckpoint: z
      .object({
        title: z.string(),
        date: z.string().optional(),
        status: z.enum(["done", "current", "upcoming", "waiting_client"]),
      })
      .strict()
      .optional(),
    pm: pmZ.optional(),
    team: z.array(pmZ),
    lastUpdateAt: z.string().optional(),
    openRequests: z.number(),
    docCount: z.number(),
    invoiceSummary: z.object({ pending: z.number(), overdue: z.number() }).strict(),
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

export const portalMetaZ = z
  .object({
    brand: z
      .object({
        name: z.string(),
        logoUrl: z.string().optional(),
        accent: z.string().optional(),
      })
      .strict(),
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
