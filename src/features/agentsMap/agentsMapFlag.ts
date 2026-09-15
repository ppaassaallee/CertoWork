/**
 * VITE_AGENTS_MAP_ENABLED — shipped on by default.
 * Set to 0/false/off only to force the legacy Lista/Recetas shell.
 */
export function isAgentsMapEnabled(): boolean {
  const raw = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_AGENTS_MAP_ENABLED ?? "",
  )
    .trim()
    .toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  // Unset, empty, or any truthy value → map on (including production).
  return true;
}

export type AgentsAreaTab = "map" | "agents" | "routines" | "runs" | "analytics";

const TAB_KEY = "certo-agents-area-tab";

export function readAgentsAreaTab(): AgentsAreaTab {
  if (typeof localStorage === "undefined") return "map";
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (
      raw === "map" ||
      raw === "agents" ||
      raw === "routines" ||
      raw === "runs" ||
      raw === "analytics"
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "map";
}

export function writeAgentsAreaTab(tab: AgentsAreaTab) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}
