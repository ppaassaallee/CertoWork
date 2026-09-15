/**
 * VITE_AGENTS_MAP_ENABLED — aggregate “Red de agentes” map.
 * Default OFF. The per-routine Flujo is the Rutinas entry point.
 * Opt in with 1/true/on for Agentes › Analítica.
 */
export function isAgentsMapEnabled(): boolean {
  const raw = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_AGENTS_MAP_ENABLED ?? "",
  )
    .trim()
    .toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true;
  return false;
}

export type AgentsAreaTab = "map" | "agents" | "routines" | "runs" | "analytics";

const TAB_KEY = "certo-agents-area-tab";

export function readAgentsAreaTab(): AgentsAreaTab {
  if (typeof localStorage === "undefined") return "agents";
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
  return "agents";
}

export function writeAgentsAreaTab(tab: AgentsAreaTab) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}
