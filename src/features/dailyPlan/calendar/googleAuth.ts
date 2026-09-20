/**
 * Google Identity Services code client for calendar connect.
 * Shows not-configured when VITE_GOOGLE_OAUTH_CLIENT_ID is missing.
 */
export function isGoogleCalendarConfigured(): boolean {
  const id = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_GOOGLE_OAUTH_CLIENT_ID || "",
  ).trim();
  return Boolean(id);
}

export async function requestGoogleCalendarCode(): Promise<string> {
  const clientId = String(
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_GOOGLE_OAUTH_CLIENT_ID || "",
  ).trim();
  if (!clientId) throw new Error("calendar-not-configured");

  await loadGis();
  const google = (window as any).google;
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.readonly openid email profile",
      ux_mode: "popup",
      access_type: "offline",
      prompt: "consent",
      callback: (resp: { code?: string; error?: string }) => {
        if (resp.error || !resp.code) reject(new Error(resp.error || "No code"));
        else resolve(resp.code);
      },
    });
    client.requestCode();
  });
}

function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.gis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(script);
  });
}
