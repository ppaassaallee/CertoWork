export function chatwootConfig(env = {}) {
  const origin = String(env.CHATWOOT_URL || "").trim().replace(/\/+$/, "");
  const token = String(env.CHATWOOT_PLATFORM_TOKEN || "").trim();
  const accountId = String(env.CHATWOOT_ACCOUNT_ID || "").trim();
  return {
    origin,
    token,
    accountId,
    configured: Boolean(origin && token && accountId),
  };
}

export function collabStatusPayload(env = {}) {
  const { origin, accountId, configured } = chatwootConfig(env);
  return {
    configured,
    origin: configured ? origin : "",
    accountId: configured ? accountId : "",
    ready: configured,
  };
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "x");
  return `Cw.${raw}9!`;
}

async function chatwootRequest(env, path, { method = "GET", body } = {}) {
  const { origin, token } = chatwootConfig(env);
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      api_access_token: token,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Chatwoot ${method} ${path} failed`;
    throw new Error(message);
  }
  return payload;
}

export async function provisionCollabSso(env, input) {
  const config = chatwootConfig(env);
  if (!config.configured) {
    const error = new Error("Chat Collab is not configured.");
    error.status = 503;
    error.configured = false;
    throw error;
  }
  const email = String(input.email || "").trim().toLowerCase();
  const displayName = String(input.displayName || email || "Certo Work").trim();
  if (!email) {
    const error = new Error("A signed-in email is required for Chat Collab.");
    error.status = 400;
    throw error;
  }

  const user = await chatwootRequest(env, "/platform/api/v1/users", {
    method: "POST",
    body: {
      name: displayName,
      display_name: displayName,
      email,
      password: randomPassword(),
      custom_attributes: {
        certoUserId: input.userId || "",
        certoWorkspaceId: input.workspaceId || "",
      },
    },
  });
  const userId = user?.id;
  if (!userId) throw new Error("Chatwoot did not return a user.");

  await chatwootRequest(env, `/platform/api/v1/accounts/${config.accountId}/account_users`, {
    method: "POST",
    body: { user_id: userId, role: "agent" },
  });

  const login = await chatwootRequest(env, `/platform/api/v1/users/${userId}/login`);
  if (!login?.url) throw new Error("Chatwoot did not return a sign-in link.");
  return { url: login.url, userId };
}
