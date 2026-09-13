/**
 * VITE_ITEM_MODAL_V2 — default on in dev, off in production until flipped.
 */
export function isItemModalV2Enabled(): boolean {
  const raw = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_ITEM_MODAL_V2 ?? "",
  )
    .trim()
    .toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true;
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean; PROD?: boolean } }).env;
  if (env?.DEV) return true;
  return false;
}
