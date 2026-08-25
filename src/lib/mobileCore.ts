import { resolveDelivereeLens } from "./delivereeRoutes";

export const MOBILE_CORE_MAX_WIDTH = 760;

export const MOBILE_CORE_TABS = [
  { id: "home", label: "Home", path: "/home" },
  { id: "my-work", label: "My Work", path: "/my-work" },
  { id: "projects", label: "Projects", path: "/projects" },
  { id: "notes", label: "Notes", path: "/notes" },
] as const;

export function isMobileCoreViewport(width = typeof window === "undefined" ? 1024 : window.innerWidth) {
  return width <= MOBILE_CORE_MAX_WIDTH;
}

export function mobileCoreFallbackPath(pathname: string): string | null {
  const lens = resolveDelivereeLens(pathname);
  if (
    lens.kind === "agents" ||
    lens.kind === "approvals" ||
    lens.kind === "feedback" ||
    lens.kind === "invoices" ||
    lens.kind === "more"
  ) {
    return "/home";
  }
  if (lens.kind === "project" && lens.tab === "strategy") {
    return `/work/projects/${lens.projectId}`;
  }
  return null;
}

export function mobileCoreTab(pathname: string): (typeof MOBILE_CORE_TABS)[number]["id"] | null {
  const lens = resolveDelivereeLens(pathname);
  if (lens.kind === "settings") return null;
  if (lens.kind === "my-work") return "my-work";
  if (lens.kind === "work") return "projects";
  if (lens.kind === "project") return lens.tab === "notes" ? "notes" : "projects";
  return "home";
}
