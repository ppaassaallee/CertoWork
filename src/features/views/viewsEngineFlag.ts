/**
 * VITE_VIEWS_ENGINE — legacy flag for spreadsheet ViewGrid on project Items.
 * Project Items and My Work now always use the Asana WorkItemsCenter list body
 * with views engine chrome (ViewsBar / applyView) underneath.
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
