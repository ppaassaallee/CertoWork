/**
 * Assistant access settings UI. Off unless VITE_ASSISTANT_ACCESS is
 * 1 / true / on / yes. The server stays off until ASSISTANT_ACCESS_ENABLED
 * is set the same way. Both default off so production behavior is unchanged.
 */
export function isAssistantAccessUiEnabled(): boolean {
  const raw = String(
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      ?.VITE_ASSISTANT_ACCESS ?? "",
  )
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}
