export type CollabStatus = {
  configured: boolean;
  origin: string;
  accountId: string;
  ready: boolean;
  mount?: string;
  error?: string;
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
const SSO_TIMEOUT_MS = 20_000;
const READY_TIMEOUT_MS = 4_000;
const LOGIN_TIMEOUT_MS = 12_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function collabSessionIsReady() {
  try {
    const profile = await withTimeout(
      fetch("/api/v1/profile", {
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
      READY_TIMEOUT_MS,
      "Chat Collab session check timed out.",
    );
    if (profile.ok) return true;
    if (profile.status === 401 || profile.status === 403) return false;
    const desk = await withTimeout(
      fetch(COLLAB_DESK_PATH, {
        credentials: "include",
        redirect: "manual",
      }),
      READY_TIMEOUT_MS,
      "Chat Collab desk check timed out.",
    );
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
  await withTimeout(
    fetch(target, { credentials: "include", redirect: "follow" }),
    LOGIN_TIMEOUT_MS,
    "Chat Collab sign-in timed out.",
  );
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
  const sso = await withTimeout(
    startCollabSso(input),
    SSO_TIMEOUT_MS,
    "Chat Collab SSO timed out. Check CHATWOOT_URL points at the private host proxied by certo.work.",
  );
  const loginUrl = sso.loginUrl || (sso.url && /\/app\/login/.test(sso.url) ? sso.url : "");
  if (!loginUrl) {
    if (sso.error) return sso;
    // Fall open to same-origin desk so the iframe can still load if cookies exist.
    return { ...sso, url: COLLAB_DESK_PATH, configured: sso.configured !== false };
  }
  try {
    await consumeCollabLogin(loginUrl);
  } catch (reason) {
    return {
      ...sso,
      url: COLLAB_DESK_PATH,
      configured: true,
      error:
        reason instanceof Error
          ? reason.message
          : "Chat Collab sign-in did not finish; opening the desk anyway.",
    };
  }
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
  try {
    await openCollabDesk(input);
  } catch {
    // Warm is best-effort; Collab tab will retry.
  }
}

export async function loadCollabStatus(): Promise<CollabStatus> {
  const response = await withTimeout(
    fetch("/api/collab/status"),
    READY_TIMEOUT_MS,
    "Chat Collab status timed out.",
  ).catch(() => null);
  if (!response) {
    return {
      configured: false,
      origin: "",
      accountId: "",
      ready: false,
      error: "Chat Collab status timed out.",
    };
  }
  const payload = (await response.json().catch(() => ({}))) as CollabStatus;
  if (!response.ok) {
    return {
      configured: false,
      origin: "",
      accountId: "",
      ready: false,
      error: payload.error || "Chat Collab is not available.",
    };
  }
  return {
    configured: Boolean(payload.configured),
    origin: String(payload.origin || ""),
    accountId: String(payload.accountId || ""),
    ready: Boolean(payload.ready),
    mount: payload.mount,
    error: payload.error,
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
