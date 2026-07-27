export function getAppBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (import.meta as any).env?.VITE_BOLDI_APP_URL || "https://gazelle.ai";
}

export function buildInviteUrl(token: string): string {
  try {
    const base = getAppBaseUrl();
    const url = new URL(`/workspace-join?token=${token}`, base);
    return url.toString();
  } catch (e) {
    console.error("Invalid base URL in buildInviteUrl, using fallback", e);
    return `https://gazelle.ai/workspace-join?token=${token}`;
  }
}

export function buildMobileUrl(inviteUrl: string): string {
  try {
    // safely strip trailing slashes, validate input URL pattern
    if (!inviteUrl || !inviteUrl.startsWith("http")) {
      throw new Error("Invalid URL structure");
    }
    const url = new URL(inviteUrl);
    return `gazelle://invite?host=${encodeURIComponent(url.host)}&token=${encodeURIComponent(url.searchParams.get("token") || "")}`;
  } catch (e) {
    console.error("Failed to build mobile deep-link URL", e);
    return "gazelle://invite?error=invalid_url";
  }
}
