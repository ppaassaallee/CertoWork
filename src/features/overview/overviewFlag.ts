/**
 * VITE_OVERVIEW_ENABLED — default on in dev, off in production until flipped.
 * Explicit 0/false/off wins; explicit 1/true/on wins.
 */
export function isOverviewEnabled(): boolean {
  const raw = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_OVERVIEW_ENABLED ?? "",
  )
    .trim()
    .toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true;
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean; PROD?: boolean } }).env;
  if (env?.DEV) return true;
  return false;
}

export const PROJECT_VIEW_STORAGE_PREFIX = "certo-project-surface-view:";
export const MY_WORK_OVERVIEW_COLLAPSED_KEY = "certo-my-work-overview-collapsed";

export function readProjectSurfaceView(projectId: string): string | null {
  if (typeof localStorage === "undefined" || !projectId) return null;
  try {
    return localStorage.getItem(`${PROJECT_VIEW_STORAGE_PREFIX}${projectId}`);
  } catch {
    return null;
  }
}

export function writeProjectSurfaceView(projectId: string, view: string) {
  if (typeof localStorage === "undefined" || !projectId) return;
  try {
    localStorage.setItem(`${PROJECT_VIEW_STORAGE_PREFIX}${projectId}`, view);
  } catch {
    /* ignore quota */
  }
}

export function readMyWorkOverviewCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(MY_WORK_OVERVIEW_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMyWorkOverviewCollapsed(collapsed: boolean) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(MY_WORK_OVERVIEW_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}
