/**
 * VITE_VIEWS_ENGINE — project Items table uses ViewGrid when on.
 * Off by default so WorkItemsCenter stays identical until flipped.
 *
 * My Work always uses the views engine for saved views / filters (applyView),
 * but renders the Asana-style WorkItemsCenter list body (not ViewGrid).
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
