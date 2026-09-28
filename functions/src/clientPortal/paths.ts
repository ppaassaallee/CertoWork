export const CLIENTS = "clients";
export const PORTAL_MEMBERS = "portal_members";
export const PROJECT_UPDATES = "project_updates";
export const CLIENT_APPROVALS = "client_approvals";
export const CLIENT_PORTAL = "client_portal";
export const PORTAL_EVENTS = "portal_events";

export function portalRoot(clientId: string) {
  return `${CLIENT_PORTAL}/${clientId}`;
}

export function portalDoc(clientId: string, sub: string, id: string) {
  return `${portalRoot(clientId)}/${sub}/${id}`;
}

export function portalMeta(clientId: string) {
  return `${portalRoot(clientId)}/meta/portal`;
}
