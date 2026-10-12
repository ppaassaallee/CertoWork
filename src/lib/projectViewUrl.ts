const TOKEN_TO_CHROME: Record<string, string> = {
  board: "kanban",
  table: "list",
  gantt: "gantt",
  calendar: "calendar",
  costs: "costs",
  docs: "docs",
  tables: "tables",
  kanban: "kanban",
  list: "list",
  overview: "overview",
  flow: "flow",
  epics: "epics",
};

const CHROME_TO_TOKEN: Record<string, string> = {
  kanban: "board",
  list: "table",
  gantt: "gantt",
  calendar: "calendar",
  costs: "costs",
  docs: "docs",
  tables: "tables",
  overview: "overview",
  flow: "flow",
  epics: "epics",
};

const CHROME_VIEWS = new Set(Object.keys(CHROME_TO_TOKEN));
const WORK_ITEM_MODES = new Set(["list", "kanban", "gantt", "calendar", "flow", "epics"]);

function paramsFrom(search: string) {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw);
}

export function isProjectChromeView(value: string) {
  return CHROME_VIEWS.has(value);
}

/** Chrome view id for a project `?view=` token. Portfolio economics is not a project view. */
export function chromeViewFromSearch(search: string): string | null {
  const raw = String(paramsFrom(search).get("view") || "").toLowerCase();
  if (!raw || raw === "economics") return null;
  return TOKEN_TO_CHROME[raw] || null;
}

export function viewTokenForChrome(view: string): string | null {
  return CHROME_TO_TOKEN[view] || null;
}

export function searchWithProjectView(search: string, chromeView: string) {
  const params = paramsFrom(search);
  const token = viewTokenForChrome(chromeView);
  if (token) params.set("view", token);
  else params.delete("view");
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function itemIdFromSearch(search: string): string | null {
  const id = String(paramsFrom(search).get("item") || "").trim();
  return id || null;
}

export function searchWithItem(search: string, itemId: string | null) {
  const params = paramsFrom(search);
  if (itemId) params.set("item", itemId);
  else params.delete("item");
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function tabForProjectView(chromeView: string | null): "docs" | "costs" | "tables" | "items" | null {
  if (!chromeView) return null;
  if (chromeView === "docs" || chromeView === "costs" || chromeView === "tables") return chromeView;
  return "items";
}

export function workItemsModeForProjectView(chromeView: string | null): string | null {
  if (!chromeView || !WORK_ITEM_MODES.has(chromeView)) return null;
  return chromeView;
}

export type ProjectRoutePhase = "ready" | "loading" | "missing";

/** Empty project list is still hydrating. A populated list missing the id is a real miss. */
export function projectRouteState(projectCount: number, found: boolean): ProjectRoutePhase {
  if (found) return "ready";
  if (projectCount === 0) return "loading";
  return "missing";
}

/** Already viewing this project, including its notes/tasks/strategy tabs. */
export function staysOnProjectPath(pathname: string, projectId: string) {
  const id = encodeURIComponent(String(projectId || "").trim());
  if (!id) return false;
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  const target = `/work/projects/${id}`;
  return path === target || path.startsWith(`${target}/`);
}

/** Close the open item only when the user moves from one project to another. */
export function shouldCloseItemOnProjectChange(previousId: string, nextId: string) {
  const previous = String(previousId || "");
  const next = String(nextId || "");
  return Boolean(previous) && Boolean(next) && previous !== next;
}
