export const COLLAB_PATH = "/collab";

export type CertoProduct = "work" | "collab";

export function isCollabPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === COLLAB_PATH || path.startsWith(`${COLLAB_PATH}/`);
}

export function productFromPath(pathname: string): CertoProduct {
  return isCollabPath(pathname) ? "collab" : "work";
}

export function productHomePath(product: CertoProduct) {
  return product === "collab" ? COLLAB_PATH : "/home";
}

export function collabProjectPath(projectId: string) {
  const id = String(projectId || "").trim();
  return id ? `${COLLAB_PATH}/projects/${encodeURIComponent(id)}` : COLLAB_PATH;
}

export function collabProjectIdFromLocation(pathname: string, search = "") {
  const path = pathname.replace(/\/+$/, "") || "/";
  const match = path.match(/^\/collab\/projects\/([^/]+)$/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  const query = search.startsWith("?") ? search.slice(1) : search;
  return String(new URLSearchParams(query).get("project") || "").trim();
}

export function projectRoomIdentifier(projectId: string) {
  return `certo:project:${String(projectId || "").trim()}`;
}

export function projectRoomName(name: string) {
  const title = String(name || "Project").trim() || "Project";
  return `Room · ${title}`.slice(0, 80);
}

export function chatwootOrigin(value: string) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function isConfiguredCollab(status: { configured?: boolean; origin?: string } | null) {
  return Boolean(status?.configured);
}
