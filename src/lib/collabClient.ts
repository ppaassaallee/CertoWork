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
  kind?: "project" | "channel";
  inboxId?: number | string;
  conversationId?: number | string;
  lastActivityAt?: number;
  path?: string;
  url?: string;
};

export type CollabChannel = {
  id: string;
  name: string;
  kind?: "channel";
  inboxId?: number | string;
  lastActivityAt?: number;
  path?: string;
  url?: string;
};

export type CollabSsoResult = {
  url?: string;
  loginUrl?: string;
  roomUrl?: string;
  rooms?: CollabRoom[];
  channels?: CollabChannel[];
  error?: string;
  configured?: boolean;
};

const COLLAB_DESK_PATH = "/app";

export async function collabSessionIsReady() {
  try {
    const profile = await fetch("/api/v1/profile", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (profile.ok) return true;
    if (profile.status === 401 || profile.status === 403) return false;
    const desk = await fetch(COLLAB_DESK_PATH, {
      credentials: "include",
      redirect: "manual",
    });
    const location = desk.headers.get("location") || "";
    return (
      desk.ok ||
      (desk.status >= 300 &&
        desk.status < 400 &&
        !/login|sign[_-]?in/i.test(location))
    );
  } catch {
    return false;
  }
}

export async function consumeCollabLogin(loginUrl: string) {
  const target = String(loginUrl || "").trim();
  if (!target) return;
  await fetch(target, { credentials: "include", redirect: "follow" });
}

export async function openCollabDesk(input: {
  token: string;
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
  company?: string;
  projectId?: string;
  projects?: Array<{ id: string; name: string }>;
}): Promise<CollabSsoResult> {
  if (await collabSessionIsReady()) {
    return { url: COLLAB_DESK_PATH, configured: true };
  }
  const sso = await startCollabSso(input);
  const loginUrl = sso.loginUrl || (sso.url && /\/app\/login/.test(sso.url) ? sso.url : "");
  if (!loginUrl) return sso;
  await consumeCollabLogin(loginUrl);
  return {
    ...sso,
    url: COLLAB_DESK_PATH,
    configured: true,
  };
}

export async function warmCollabSession(input: {
  token: string;
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
  company?: string;
}) {
  if (!input.email || !input.userId) return;
  await openCollabDesk(input);
}

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
  company?: string;
  projectId?: string;
  projects?: Array<{ id: string; name: string }>;
}): Promise<CollabSsoResult> {
  return postCollab("sso", input);
}

export async function syncCollabRooms(input: {
  token: string;
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
  company?: string;
  projectId?: string;
  projects?: Array<{ id: string; name: string }>;
}): Promise<CollabSsoResult> {
  return postCollab("rooms", input);
}

async function postCollab(
  path: "sso" | "rooms",
  input: {
    token: string;
    userId: string;
    workspaceId: string;
    email: string;
    displayName: string;
    company?: string;
    projectId?: string;
    projects?: Array<{ id: string; name: string }>;
  },
): Promise<CollabSsoResult> {
  const response = await fetch(`/api/collab/${path}`, {
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
      company: input.company || "",
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
    loginUrl: payload.loginUrl,
    roomUrl: payload.roomUrl,
    rooms: Array.isArray(payload.rooms) ? payload.rooms : [],
    channels: Array.isArray(payload.channels) ? payload.channels : [],
    configured: true,
  };
}
