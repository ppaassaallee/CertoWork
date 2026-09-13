/**
 * VITE_ITEM_MODAL_V2 — on unless explicitly disabled (0/false/off).
 * Shipped on for production so the redesign is visible after deploy.
 */
export function isItemModalV2Enabled(): boolean {
  const raw = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_ITEM_MODAL_V2 ?? "",
  )
    .trim()
    .toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  return true;
}
