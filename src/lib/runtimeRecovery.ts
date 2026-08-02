const RECOVERY_KEY = "delivereeos_asset_recovery";
const RECOVERY_WINDOW_MS = 60_000;

export function isStaleAssetError(reason: unknown) {
  const message = String(
    reason instanceof Error
      ? reason.message
      : (reason as { message?: unknown })?.message || reason || "",
  ).toLowerCase();

  return [
    "failed to fetch dynamically imported module",
    "error loading dynamically imported module",
    "importing a module script failed",
    "chunkloaderror",
    "loading chunk",
  ].some((pattern) => message.includes(pattern));
}

export function installRuntimeRecovery() {
  if (typeof window === "undefined") return;

  const recover = (event: Event, reason: unknown) => {
    if (!isStaleAssetError(reason)) return;

    const lastAttempt = Number(window.sessionStorage.getItem(RECOVERY_KEY) || 0);
    if (Date.now() - lastAttempt < RECOVERY_WINDOW_MS) return;

    event.preventDefault?.();
    window.sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    window.location.reload();
  };

  window.addEventListener("vite:preloadError", (event: Event) => {
    recover(event, (event as Event & { payload?: unknown }).payload);
  });
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    recover(event, event.reason);
  });
  window.addEventListener("error", (event: ErrorEvent) => {
    recover(event, event.error || event.message);
  });

  window.setTimeout(() => window.sessionStorage.removeItem(RECOVERY_KEY), 10_000);
}
