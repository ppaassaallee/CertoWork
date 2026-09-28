/** Firestore collection / path helpers for Client Portal. */

export const CLIENTS_COLLECTION = "clients";
export const PORTAL_MEMBERS_COLLECTION = "portal_members";
export const PROJECT_UPDATES_COLLECTION = "project_updates";
export const CLIENT_APPROVALS_COLLECTION = "client_approvals";
export const CLIENT_PORTAL_ROOT = "client_portal";
export const PORTAL_EVENTS_COLLECTION = "portal_events";
export const CLIENT_STATS_COLLECTION = "client_stats";

export const PORTAL_SUB = {
  projects: "projects",
  updates: "updates",
  timeline: "timeline",
  items: "items",
  documents: "documents",
  invoices: "invoices",
  approvals: "approvals",
  threads: "threads",
  activity: "activity",
  csat: "csat",
  meta: "meta",
} as const;

export function clientDocPath(clientId: string) {
  return `${CLIENTS_COLLECTION}/${clientId}`;
}

export function portalMemberPath(uid: string) {
  return `${PORTAL_MEMBERS_COLLECTION}/${uid}`;
}

export function clientPortalRoot(clientId: string) {
  return `${CLIENT_PORTAL_ROOT}/${clientId}`;
}

export function portalProjectPath(clientId: string, projectId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.projects}/${projectId}`;
}

export function portalUpdatePath(clientId: string, updateId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.updates}/${updateId}`;
}

export function portalTimelinePath(clientId: string, projectId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.timeline}/${projectId}`;
}

export function portalItemPath(clientId: string, taskId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.items}/${taskId}`;
}

export function portalDocumentPath(clientId: string, docId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.documents}/${docId}`;
}

export function portalInvoicePath(clientId: string, invoiceId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.invoices}/${invoiceId}`;
}

export function portalApprovalPath(clientId: string, approvalId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.approvals}/${approvalId}`;
}

export function portalThreadPath(clientId: string, conversationId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.threads}/${conversationId}`;
}

export function portalActivityPath(clientId: string, activityId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.activity}/${activityId}`;
}

export function portalCsatPath(clientId: string, csatId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.csat}/${csatId}`;
}

export function portalMetaPath(clientId: string) {
  return `${clientPortalRoot(clientId)}/${PORTAL_SUB.meta}/portal`;
}

export function clientStatsDayPath(clientId: string, date: string) {
  return `${CLIENT_STATS_COLLECTION}/${clientId}/days/${date}`;
}

export function slugifyClientName(name: string) {
  return String(name || "client")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "client";
}
