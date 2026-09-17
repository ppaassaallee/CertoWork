/**
 * VITE_VIEWS_ENGINE — project Items table uses ViewGrid when on.
 * Off by default so WorkItemsCenter stays identical until flipped.
 */
export function isViewsEngineEnabled(): boolean {
  const raw = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_VIEWS_ENGINE ?? "",
  )
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}
