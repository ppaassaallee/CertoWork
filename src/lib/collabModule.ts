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

export function chatwootOrigin(value: string) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function isConfiguredCollab(status: { configured?: boolean; origin?: string } | null) {
  return Boolean(status?.configured && chatwootOrigin(status.origin || ""));
}
