/**
 * Track B — Agents that own a job (feature flag).
 * Default ON in development so the builder is reachable; production can set
 * VITE_AGENTS_JOBS_ENABLED=0 to hide Track B chrome.
 */
export function isAgentsJobsEnabled(): boolean {
  const raw = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_AGENTS_JOBS_ENABLED ?? "1",
  )
    .trim()
    .toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  return true;
}
