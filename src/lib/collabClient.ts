export type CollabStatus = {
  configured: boolean;
  origin: string;
  accountId: string;
  ready: boolean;
  mount?: string;
};

export type CollabRoom = {
  projectId: string;
  name: string;
  inboxId?: number | string;
  conversationId?: number | string;
  path?: string;
  url?: string;
};

export type CollabSsoResult = {
  url?: string;
  roomUrl?: string;
  rooms?: CollabRoom[];
  error?: string;
  configured?: boolean;
};

export async function loadCollabStatus(): Promise<CollabStatus> {
  const response = await fetch("/api/collab/status");
  const payload = (await response.json().catch(() => ({}))) as CollabStatus;
  if (!response.ok) {
    return { configured: false, origin: "", accountId: "", ready: false };
  }
  return {
    configured: Boolean(payload.configured),
    origin: String(payload.origin || ""),
    accountId: String(payload.accountId || ""),
    ready: Boolean(payload.ready),
    mount: payload.mount,
  };
}

export async function startCollabSso(input: {
  token: string;
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
  projectId?: string;
  projects?: Array<{ id: string; name: string }>;
}): Promise<CollabSsoResult> {
  const response = await fetch("/api/collab/sso", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: input.userId,
      workspaceId: input.workspaceId,
      email: input.email,
      displayName: input.displayName,
      projectId: input.projectId || "",
      projects: input.projects || [],
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as CollabSsoResult;
  if (!response.ok) {
    return {
      configured: payload.configured,
      error: payload.error || "Chat Collab could not sign you in.",
    };
  }
  return {
    url: payload.url,
    roomUrl: payload.roomUrl,
    rooms: Array.isArray(payload.rooms) ? payload.rooms : [],
    configured: true,
  };
}
