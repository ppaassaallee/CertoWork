/**
 * Pure projection builders — strip to view shapes; zod-validated at write time.
 */
import {
  DEFAULT_PORTAL_SETTINGS,
  type ApprovalView,
  type DocumentView,
  type InvoiceView,
  type ItemView,
  type PortalSettings,
  type ProjectView,
  type TimelineItem,
  type TimelineView,
  type UpdateView,
  approvalViewZ,
  documentViewZ,
  invoiceViewZ,
  itemViewZ,
  parseStrict,
  projectViewZ,
  timelineViewZ,
  updateViewZ,
} from "./types";

function asString(value: unknown, fallback = "") {
  return value == null ? fallback : String(value);
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildProjectView(input: {
  project: Record<string, unknown>;
  settings: PortalSettings;
  milestones?: Array<Record<string, unknown>>;
  openRequests?: number;
  docCount?: number;
  invoiceSummary?: { pending: number; overdue: number };
  lastUpdateAt?: string;
  team?: ProjectView["team"];
  pm?: ProjectView["pm"];
}): ProjectView {
  const p = input.project;
  const milestones = input.milestones || [];
  const nextMs = milestones
    .filter((m) => String(m.status || "").toLowerCase() !== "done")
    .sort((a, b) => asString(a.dueDate || a.date).localeCompare(asString(b.dueDate || b.date)))[0];

  const view: ProjectView = {
    id: asString(p.id),
    name: asString(p.title || p.name || "Project"),
    code: p.projectKey || p.key ? asString(p.projectKey || p.key) : undefined,
    health: p.health ? asString(p.health) : undefined,
    stage: p.stage ? asString(p.stage) : undefined,
    phase: p.phase ? asString(p.phase) : undefined,
    progressPct:
      p.progressPct != null
        ? asNumber(p.progressPct)
        : p.progress != null
          ? asNumber(p.progress)
          : undefined,
    nextCheckpoint: nextMs
      ? {
          title: asString(nextMs.title || nextMs.name, "Checkpoint"),
          date: nextMs.dueDate || nextMs.date ? asString(nextMs.dueDate || nextMs.date) : undefined,
          status: "upcoming",
        }
      : p.phase
        ? { title: asString(p.phase), status: "current" }
        : undefined,
    pm: input.pm,
    team: input.team || [],
    lastUpdateAt: input.lastUpdateAt,
    openRequests: input.openRequests ?? 0,
    docCount: input.docCount ?? 0,
    invoiceSummary: input.invoiceSummary || { pending: 0, overdue: 0 },
    visibility: input.settings || DEFAULT_PORTAL_SETTINGS,
  };
  return parseStrict(projectViewZ, view);
}

export function buildTimelineView(input: {
  projectId: string;
  project: Record<string, unknown>;
  milestones?: Array<Record<string, unknown>>;
}): TimelineView {
  const items: TimelineItem[] = [];
  const stage = asString(input.project.stage);
  const phase = asString(input.project.phase);
  if (stage) {
    items.push({ id: `stage-${stage}`, title: stage, kind: "stage", status: "current" });
  }
  if (phase) {
    items.push({
      id: `checkpoint-${phase}`,
      title: phase,
      kind: "checkpoint",
      status: "current",
    });
  }
  for (const m of input.milestones || []) {
    const statusRaw = asString(m.status || m.clientStatus).toLowerCase();
    const status: TimelineItem["status"] =
      statusRaw === "done" || statusRaw === "completed"
        ? "done"
        : statusRaw.includes("wait") || statusRaw.includes("client")
          ? "waiting_client"
          : "upcoming";
    items.push({
      id: asString(m.id),
      title: asString(m.title || m.name, "Milestone"),
      date: m.dueDate || m.date ? asString(m.dueDate || m.date) : undefined,
      kind: "milestone",
      status,
    });
  }
  return parseStrict(timelineViewZ, { projectId: input.projectId, items });
}

export function buildItemView(task: Record<string, unknown>): ItemView {
  const isRequest = Boolean(
    task.ticketStatus ||
      task.requesterEmail ||
      asString(task.kind).toLowerCase() === "ticket" ||
      asString(task.captureIntent).toLowerCase() === "request",
  );
  const sla = task.sla && typeof task.sla === "object" ? (task.sla as Record<string, unknown>) : null;
  const view: ItemView = {
    id: asString(task.id),
    projectId: asString(task.projectId),
    title: asString(task.title || task.name, "Item"),
    status: asString(task.customerStatus || task.status || task.ticketStatus, "open"),
    dueDate: task.dueDate ? asString(task.dueDate) : undefined,
    lastPublicUpdate: task.lastPublicUpdate ? asString(task.lastPublicUpdate) : undefined,
    kind: isRequest ? "request" : "work",
    requestNumber: task.key || task.requestNumber ? asString(task.key || task.requestNumber) : undefined,
    sla: sla
      ? {
          dueAt: sla.dueAt || sla.nextUpdateDueAt ? asString(sla.dueAt || sla.nextUpdateDueAt) : undefined,
          breached: Boolean(sla.breached),
        }
      : undefined,
  };
  return parseStrict(itemViewZ, view);
}

export function buildDocumentView(doc: Record<string, unknown>): DocumentView {
  return parseStrict(documentViewZ, {
    id: asString(doc.id),
    projectId: asString(doc.projectId),
    name: asString(doc.name || doc.title || doc.fileName, "Document"),
    mime: doc.mime || doc.contentType ? asString(doc.mime || doc.contentType) : undefined,
    size: doc.size != null ? asNumber(doc.size) : undefined,
    publishedAt: doc.publishedAt || doc.createdAt ? asString(doc.publishedAt || doc.createdAt) : undefined,
    signed: doc.signed === true || doc.clientSigned === true,
  });
}

export function buildInvoiceView(inv: Record<string, unknown>): InvoiceView {
  return parseStrict(invoiceViewZ, {
    id: asString(inv.id),
    projectId: inv.projectId ? asString(inv.projectId) : undefined,
    number: asString(inv.invoiceNumber || inv.number || inv.id),
    amount: asNumber(inv.amount),
    currency: asString(inv.currency || "USD"),
    issueDate: inv.issueDate ? asString(inv.issueDate) : undefined,
    dueDate: inv.dueDate ? asString(inv.dueDate) : undefined,
    status: asString(inv.status, "sent"),
    paymentStatus: inv.paymentStatus ? asString(inv.paymentStatus) : undefined,
    paymentLink: inv.paymentLink ? asString(inv.paymentLink) : undefined,
    approvedAt: inv.approvedAt ? asString(inv.approvedAt) : undefined,
  });
}

export function buildApprovalView(a: Record<string, unknown>): ApprovalView {
  return parseStrict(approvalViewZ, {
    id: asString(a.id),
    projectId: asString(a.projectId),
    kind: asString(a.kind, "question") as ApprovalView["kind"],
    title: asString(a.title),
    description: a.description ? asString(a.description) : undefined,
    dueAt: a.dueAt ? asString(a.dueAt) : undefined,
    status: asString(a.status, "pending") as ApprovalView["status"],
    decidedBy: a.decidedBy ? asString(a.decidedBy) : undefined,
    decidedAt: a.decidedAt ? asString(a.decidedAt) : undefined,
    comment: a.comment ? asString(a.comment) : undefined,
    requestedAt: asString(a.requestedAt || a.createdAt || new Date().toISOString()),
  });
}

export function buildUpdateView(input: {
  update: Record<string, unknown>;
  author: UpdateView["author"];
}): UpdateView {
  const u = input.update;
  const period = (u.period && typeof u.period === "object" ? u.period : {}) as Record<string, unknown>;
  const needs = Array.isArray(u.needsClient) ? u.needsClient : [];
  return parseStrict(updateViewZ, {
    id: asString(u.id),
    projectId: asString(u.projectId),
    period: {
      from: asString(period.from),
      to: asString(period.to),
    },
    title: asString(u.title, "Update"),
    summary: asString(u.summary),
    done: Array.isArray(u.done) ? u.done.map((x) => asString(x)) : [],
    next: Array.isArray(u.next) ? u.next.map((x) => asString(x)) : [],
    needsClient: needs.map((n) => {
      const row = (n && typeof n === "object" ? n : { text: n }) as Record<string, unknown>;
      return {
        text: asString(row.text),
        approvalId: row.approvalId ? asString(row.approvalId) : undefined,
      };
    }),
    author: input.author,
    publishedAt: asString(u.publishedAt || new Date().toISOString()),
  });
}
