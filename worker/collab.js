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

export function publicOriginFrom(value) {
  try {
    return new URL(value).origin;
  } catch {
    return String(value || "").replace(/\/+$/, "");
  }
}

export function collabStatusPayload(env = {}, publicOrigin = "") {
  const { accountId, configured } = chatwootConfig(env);
  return {
    configured,
    origin: configured ? publicOriginFrom(publicOrigin) : "",
    accountId: configured ? accountId : "",
    ready: configured,
    mount: "same-origin",
  };
}

const CHATWOOT_EXACT_PATHS = new Set(["/app", "/auth", "/cable", "/widget", "/survey", "/packs", "/vite"]);
const CHATWOOT_PREFIXES = [
  "/app/",
  "/auth/",
  "/cable/",
  "/api/v1/",
  "/api/v2/",
  "/platform/api/",
  "/survey/",
  "/packs/",
  "/vite/",
  "/vite-dev/",
  "/rails/",
  "/omniauth/",
  "/super_admin/",
  "/installation/",
  "/hc/",
  "/webhooks/",
  "/monitoring/",
  "/public/api/",
  "/swagger/",
  "/audio/",
];

export function isChatwootProxyPath(pathname) {
  const path = String(pathname || "/");
  if (path === "/__/auth" || path.startsWith("/__/auth/")) return false;
  if (path === "/api/collab" || path.startsWith("/api/collab/")) return false;
  if (path === "/api/widget" || path.startsWith("/api/widget/")) return false;
  if (path.startsWith("/widget/")) return false;
  if (CHATWOOT_EXACT_PATHS.has(path) || path === "/swagger") return true;
  return CHATWOOT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function rewriteChatwootPublicUrl(value, backendOrigin, publicOrigin) {
  const source = String(value ?? "");
  if (!source) return source;
  let fromHost = "";
  let toOrigin = "";
  let toHost = "";
  try {
    fromHost = new URL(backendOrigin).host;
  } catch {
    return source;
  }
  try {
    const next = new URL(publicOrigin);
    toOrigin = next.origin;
    toHost = next.host;
  } catch {
    return source;
  }
  if (!fromHost || !toHost || fromHost === toHost) return source;
  const toWs = toOrigin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  return source
    .split(`https://${fromHost}`).join(toOrigin)
    .split(`http://${fromHost}`).join(toOrigin)
    .split(`wss://${fromHost}`).join(toWs)
    .split(`ws://${fromHost}`).join(toWs);
}

export function rewriteChatwootLocation(location, backendOrigin, publicOrigin) {
  if (!location) return location;
  const siteOrigin = publicOriginFrom(publicOrigin);
  try {
    const next = new URL(location, `${siteOrigin}/`);
    let backendHost = "";
    try {
      backendHost = new URL(backendOrigin).host;
    } catch {
      backendHost = "";
    }
    if (backendHost && next.host === backendHost) {
      return `${siteOrigin}${next.pathname}${next.search}${next.hash}`;
    }
    if (siteOrigin && next.origin === siteOrigin) {
      return `${next.origin}${next.pathname}${next.search}${next.hash}`;
    }
  } catch {
    // Keep the original header if it is not a valid URL.
  }
  return rewriteChatwootPublicUrl(location, backendOrigin, publicOrigin) || location;
}

export function rewriteChatwootCookie(cookie) {
  return String(cookie || "").replace(/;\s*domain=[^;]*/gi, "");
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "x");
  return `Cw.${raw}9!`;
}

async function chatwootRequest(env, path, { method = "GET", body, accessToken } = {}) {
  const { origin, token } = chatwootConfig(env);
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      api_access_token: accessToken || token,
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

export function projectRoomIdentifier(projectId) {
  return `certo:project:${String(projectId || "").trim()}`;
}

export function projectRoomName(name) {
  const title = String(name || "Project").trim() || "Project";
  return `Room · ${title}`.slice(0, 80);
}

export function normalizeCollabProjects(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const projects = [];
  for (const item of input) {
    const id = String(item?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    projects.push({
      id,
      name: String(item?.name || item?.title || "Project").trim() || "Project",
    });
    if (projects.length >= 40) break;
  }
  return projects;
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.payload)) return payload.payload;
  if (Array.isArray(payload?.data?.payload)) return payload.data.payload;
  return [];
}

function conversationDisplayId(conversation) {
  return conversation?.display_id || conversation?.id || conversation?.payload?.display_id || "";
}

export function projectRoomPath(accountId, conversation) {
  const displayId = conversationDisplayId(conversation);
  if (!accountId || !displayId) return "";
  return `/app/accounts/${accountId}/conversations/${displayId}`;
}

async function mapPool(items, limit, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

async function loadAccountInboxes(env, accessToken, accountId) {
  return asList(await chatwootRequest(env, `/api/v1/accounts/${accountId}/inboxes`, { accessToken }));
}

function inboxMatchesProject(inbox, project) {
  const attrs = inbox?.additional_attributes || inbox?.channel?.additional_attributes || {};
  return attrs.certoProjectId === project.id || inbox?.name === projectRoomName(project.name);
}

async function ensureProjectInbox(env, accessToken, accountId, project, inboxes) {
  const existing = (inboxes || []).find((inbox) => inboxMatchesProject(inbox, project));
  if (existing?.id) return existing;
  const created = await chatwootRequest(env, `/api/v1/accounts/${accountId}/inboxes`, {
    method: "POST",
    accessToken,
    body: {
      name: projectRoomName(project.name),
      enable_auto_assignment: false,
      additional_attributes: { certoProjectId: project.id, certoRoom: true },
      channel: {
        type: "api",
        webhook_url: "",
        hmac_mandatory: false,
        additional_attributes: { certoProjectId: project.id },
      },
    },
  });
  const inbox = created?.payload || created;
  if (inbox?.id) inboxes.push(inbox);
  return inbox;
}

async function ensureProjectContact(env, accessToken, accountId, inboxId, project) {
  const identifier = projectRoomIdentifier(project.id);
  const search = asList(
    await chatwootRequest(
      env,
      `/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(identifier)}`,
      { accessToken },
    ),
  );
  const existing = search.find((contact) => contact?.identifier === identifier);
  if (existing?.id) return existing;
  const created = await chatwootRequest(env, `/api/v1/accounts/${accountId}/contacts`, {
    method: "POST",
    accessToken,
    body: {
      inbox_id: inboxId,
      name: project.name,
      identifier,
      custom_attributes: { certoProjectId: project.id },
    },
  });
  return created?.payload?.contact || created?.payload || created;
}

async function ensureProjectConversation(env, accessToken, accountId, inboxId, contactId, project) {
  const conversations = asList(
    await chatwootRequest(env, `/api/v1/accounts/${accountId}/conversations?inbox_id=${inboxId}`, {
      accessToken,
    }),
  );
  if (conversations[0]) return conversations[0];
  const created = await chatwootRequest(env, `/api/v1/accounts/${accountId}/conversations`, {
    method: "POST",
    accessToken,
    body: {
      inbox_id: inboxId,
      contact_id: contactId,
      source_id: projectRoomIdentifier(project.id),
      status: "open",
      additional_attributes: { certoProjectId: project.id },
      message: { content: `Project room for ${project.name}`, private: true },
    },
  });
  return created?.payload || created;
}

function conversationActivityMs(conversation) {
  const value =
    conversation?.last_activity_at ??
    conversation?.timestamp ??
    conversation?.created_at ??
    conversation?.updated_at;
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function inboxIsProjectRoom(inbox) {
  const attrs = inbox?.additional_attributes || inbox?.channel?.additional_attributes || {};
  const name = String(inbox?.name || "");
  return Boolean(attrs.certoProjectId || attrs.certoRoom) || name.startsWith("Room ·");
}

export function otherChannelPath(accountId, inboxId) {
  if (!accountId || !inboxId) return "";
  return `/app/accounts/${accountId}/inbox/${inboxId}`;
}

export async function syncProjectRooms(env, { accessToken, accountId, projects, publicOrigin }) {
  const siteOrigin = publicOriginFrom(publicOrigin);
  const list = normalizeCollabProjects(projects);
  const inboxes = await loadAccountInboxes(env, accessToken, accountId);
  const rooms = list.length
    ? (
        await mapPool(list, 5, async (project) => {
          const inbox = await ensureProjectInbox(env, accessToken, accountId, project, inboxes);
          const inboxId = inbox?.id;
          if (!inboxId) return null;
          const contact = await ensureProjectContact(env, accessToken, accountId, inboxId, project);
          const contactId = contact?.id;
          if (!contactId) return null;
          const conversation = await ensureProjectConversation(
            env,
            accessToken,
            accountId,
            inboxId,
            contactId,
            project,
          );
          const path = projectRoomPath(accountId, conversation);
          return {
            projectId: project.id,
            name: project.name,
            kind: "project",
            inboxId,
            conversationId: conversationDisplayId(conversation),
            lastActivityAt: conversationActivityMs(conversation),
            path,
            url: path && siteOrigin ? `${siteOrigin}${path}` : "",
          };
        })
      ).filter(Boolean)
    : [];
  const channels = inboxes
    .filter((inbox) => !inboxIsProjectRoom(inbox))
    .map((inbox) => {
      const path = otherChannelPath(accountId, inbox.id);
      return {
        id: String(inbox.id),
        name: String(inbox.name || "Channel"),
        kind: "channel",
        inboxId: inbox.id,
        lastActivityAt: conversationActivityMs(inbox),
        path,
        url: path && siteOrigin ? `${siteOrigin}${path}` : "",
      };
    });
  rooms.sort((left, right) => (right.lastActivityAt || 0) - (left.lastActivityAt || 0));
  channels.sort((left, right) => (right.lastActivityAt || 0) - (left.lastActivityAt || 0));
  return { rooms, channels };
}

async function applyPlatformProfile(env, { userId, accountId, displayName, company }) {
  const name = String(displayName || company || "Certo Work").trim();
  const accountName = String(company || name).trim();
  try {
    await chatwootRequest(env, `/platform/api/v1/users/${userId}`, {
      method: "PATCH",
      body: {
        name,
        display_name: name,
        ui_settings: { is_onboarding_viewed: true, onboarded: true },
      },
    });
  } catch {
    // Profile branding is best-effort; SSO still continues.
  }
  try {
    await chatwootRequest(env, `/platform/api/v1/accounts/${accountId}`, {
      method: "PATCH",
      body: { name: accountName || "Certo Work" },
    });
  } catch {
    // Account rename is best-effort.
  }
}

export async function provisionCollabSso(env, input, publicOrigin = "", options = {}) {
  const config = chatwootConfig(env);
  if (!config.configured) {
    const error = new Error("Chat Collab is not configured.");
    error.status = 503;
    error.configured = false;
    throw error;
  }
  const email = String(input.email || "").trim().toLowerCase();
  const displayName = String(input.displayName || email || "Certo Work").trim();
  const company = String(input.company || "").trim();
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
        certoCompany: company,
      },
    },
  });
  const userId = user?.id;
  if (!userId) throw new Error("Chatwoot did not return a user.");

  await chatwootRequest(env, `/platform/api/v1/accounts/${config.accountId}/account_users`, {
    method: "POST",
    body: { user_id: userId, role: "administrator" },
  });

  const login = await chatwootRequest(env, `/platform/api/v1/users/${userId}/login`);
  if (!login?.url) throw new Error("Chatwoot did not return a sign-in link.");
  const siteOrigin = publicOriginFrom(publicOrigin);
  const url = rewriteChatwootLocation(login.url, config.origin, siteOrigin || config.origin);
  await applyPlatformProfile(env, {
    userId,
    accountId: config.accountId,
    displayName,
    company,
  });

  let rooms = [];
  let channels = [];
  const selectedProjectId = String(input.projectId || "").trim();
  const syncRooms = options.syncRooms !== false;
  if (syncRooms) {
    try {
      const tokenPayload = await chatwootRequest(env, `/platform/api/v1/users/${userId}/token`, {
        method: "POST",
      });
      const accessToken = tokenPayload?.access_token;
      if (accessToken) {
        const desk = await syncProjectRooms(env, {
          accessToken,
          accountId: config.accountId,
          projects: input.projects,
          publicOrigin: siteOrigin,
        });
        rooms = desk.rooms || [];
        channels = desk.channels || [];
      }
    } catch {
      rooms = [];
      channels = [];
    }
  }

  const selected = rooms.find((room) => room.projectId === selectedProjectId) || rooms[0] || null;
  return {
    url,
    userId,
    rooms,
    channels,
    roomUrl: selected?.url || "",
  };
}

export function isCertoCollabBrandPath(pathname) {
  const path = String(pathname || "");
  return (
    path === "/brand-assets/logo.svg" ||
    path === "/brand-assets/logo_dark.svg" ||
    path === "/brand-assets/logo_thumbnail.svg"
  );
}

const COLLAB_BRAND_HEAD = `<style id="certo-collab-brand">
  html, body, #app { height: 100%; min-height: 0; }
  [data-certo-scroll-fix="1"] {
    overflow-y: auto !important;
    min-height: 0 !important;
    overscroll-behavior: contain;
    touch-action: pan-y;
  }
  #certo-collab-channel-tools {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px 10px;
  }
  #certo-channel-search {
    width: 100%;
    height: 32px;
    border: 1px solid #d9d8d4;
    border-radius: 8px;
    padding: 0 8px;
    font-size: 12px;
  }
  [data-certo-section] {
    margin: 8px 10px 4px;
    color: #6b7280;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  [data-certo-room-kind="project"].is-certo-hidden,
  [data-certo-room-kind="project"][hidden] { display: none !important; }
</style>
<script id="certo-collab-brand-script">
(function () {
  try {
    if (window.globalConfig) {
      window.globalConfig.INSTALLATION_NAME = "Certo Work";
      window.globalConfig.BRAND_NAME = "Certo Work";
      window.globalConfig.LOGO = "/certo-mark.svg";
      window.globalConfig.LOGO_DARK = "/certo-mark.svg";
      window.globalConfig.LOGO_THUMBNAIL = "/certo-mark.svg";
      window.globalConfig.BRAND_URL = "https://certo.work";
    }
  } catch (error) {}
  function textOf(node) {
    return String((node && node.textContent) || "").replace(/\\s+/g, " ").trim();
  }
  function unlockOverflow(start) {
    var current = start;
    while (current && current !== document.documentElement) {
      var style = window.getComputedStyle(current);
      if (/(hidden|clip)/.test(style.overflowY) || /(hidden|clip)/.test(style.overflow)) {
        current.style.setProperty("overflow-y", "auto", "important");
        current.style.setProperty("min-height", "0", "important");
        current.setAttribute("data-certo-scroll-fix", "1");
      }
      current = current.parentElement;
    }
  }
  function isProjectRoomText(value) {
    return /^Room\\s*·/.test(value);
  }
  function findChannelsHeading() {
    var nodes = document.querySelectorAll("button, a, h2, h3, h4, span, p, div");
    for (var i = 0; i < nodes.length; i += 1) {
      var label = textOf(nodes[i]);
      if (label === "Channels" || label === "Inboxes") return nodes[i];
    }
    return null;
  }
  function channelListRoot(heading) {
    var panel = heading.closest("aside, nav, section, li, div") || heading.parentElement;
    if (!panel) return heading.parentElement;
    return panel.querySelector("ul, [role='list']") || panel;
  }
  function ensureTools(list) {
    if (!list) return null;
    var tools = document.getElementById("certo-collab-channel-tools");
    if (tools) return tools;
    tools = document.createElement("div");
    tools.id = "certo-collab-channel-tools";
    tools.innerHTML = '<label>Project rooms<input id="certo-channel-search" placeholder="Search project rooms" type="search" /></label>';
    list.insertBefore(tools, list.firstChild);
    var input = tools.querySelector("input");
    input.addEventListener("input", function () {
      filterProjectRooms(input.value);
    });
    return tools;
  }
  function ensureSection(list, id, title, beforeNode) {
    var existing = list.querySelector('[data-certo-section="' + id + '"]');
    if (existing) return existing;
    var heading = document.createElement("p");
    heading.setAttribute("data-certo-section", id);
    heading.textContent = title;
    list.insertBefore(heading, beforeNode || null);
    return heading;
  }
  function markRows(list) {
    var rows = list.querySelectorAll("a, button, li");
    var firstProject = null;
    var firstOther = null;
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      if (row.closest("#certo-collab-channel-tools") || row.hasAttribute("data-certo-section")) continue;
      var label = textOf(row);
      if (!label || label === "Channels" || label === "Inboxes" || label.length > 90) continue;
      if (isProjectRoomText(label)) {
        row.setAttribute("data-certo-room-kind", "project");
        if (!firstProject) firstProject = row;
      } else if (row.getAttribute("href") || row.closest("ul, [role='list']")) {
        if (label === "Project rooms" || label === "Other channels") continue;
        row.setAttribute("data-certo-room-kind", "channel");
        if (!firstOther) firstOther = row;
      }
    }
    if (firstProject) ensureSection(list, "projects", "Project rooms", firstProject);
    if (firstOther) ensureSection(list, "other", "Other channels", firstOther);
  }
  function filterProjectRooms(query) {
    var needle = String(query || "").trim().toLowerCase();
    var rows = document.querySelectorAll('[data-certo-room-kind="project"]');
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var match = !needle || textOf(row).toLowerCase().indexOf(needle) !== -1;
      row.classList.toggle("is-certo-hidden", !match);
      if (match) row.removeAttribute("hidden");
      else row.setAttribute("hidden", "hidden");
    }
  }
  function enhanceChannels() {
    var heading = findChannelsHeading();
    if (!heading) return;
    unlockOverflow(heading);
    var list = channelListRoot(heading);
    if (!list) return;
    unlockOverflow(list);
    var isList = list.tagName === "UL" || list.getAttribute("role") === "list";
    if (isList || list.querySelector("[data-certo-room-kind], a, button")) {
      list.style.minHeight = "0";
      list.style.overflowY = "auto";
      list.setAttribute("data-certo-channel-list", "1");
      if (isList) {
        list.style.display = "flex";
        list.style.flexDirection = "column";
      }
      ensureTools(list);
      markRows(list);
      var input = document.getElementById("certo-channel-search");
      if (input) filterProjectRooms(input.value);
    }
    if (/inbox|settings|channel/i.test(location.pathname)) {
      unlockOverflow(document.querySelector("main") || document.body);
    }
  }
  var skipArmed = true;
  function skipOnboarding() {
    if (!skipArmed) return;
    var buttons = document.querySelectorAll("button, a");
    for (var i = 0; i < buttons.length; i += 1) {
      if (/^(skip|continue to dashboard|later)$/i.test(textOf(buttons[i]))) {
        skipArmed = false;
        buttons[i].click();
        break;
      }
    }
  }
  var timer = 0;
  function apply() {
    enhanceChannels();
    skipOnboarding();
  }
  function schedule() {
    if (timer) return;
    timer = window.setTimeout(function () {
      timer = 0;
      apply();
    }, 120);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`;

export function applyCollabBranding(html) {
  let next = String(html || "");
  next = next.replace(/<title>\s*Chatwoot\s*<\/title>/i, "<title>Certo Work</title>");
  next = next.replace(/"INSTALLATION_NAME":"Chatwoot"/g, '"INSTALLATION_NAME":"Certo Work"');
  next = next.replace(/"BRAND_NAME":"Chatwoot"/g, '"BRAND_NAME":"Certo Work"');
  next = next.replace(/"LOGO":"\/brand-assets\/logo\.svg"/g, '"LOGO":"/certo-mark.svg"');
  next = next.replace(/"LOGO_DARK":"\/brand-assets\/logo_dark\.svg"/g, '"LOGO_DARK":"/certo-mark.svg"');
  next = next.replace(/"LOGO_THUMBNAIL":"\/brand-assets\/logo_thumbnail\.svg"/g, '"LOGO_THUMBNAIL":"/certo-mark.svg"');
  next = next.replace(/href="\/brand-assets\/logo_thumbnail\.svg"/g, 'href="/certo-mark.svg"');
  if (next.includes("</head>") && !next.includes('id="certo-collab-brand"')) {
    next = next.replace("</head>", `${COLLAB_BRAND_HEAD}</head>`);
  }
  return next;
}

function shouldRewriteChatwootBody(contentType) {
  const type = String(contentType || "").toLowerCase();
  return (
    type.includes("text/html") ||
    type.includes("application/json") ||
    type.includes("javascript") ||
    type.includes("text/css") ||
    type.includes("application/xml") ||
    type.includes("text/plain")
  );
}

export async function proxyChatwoot(request, env) {
  const config = chatwootConfig(env);
  const incoming = new URL(request.url);
  if (!config.origin) {
    return new Response(JSON.stringify({ error: "Chat Collab backend is not configured." }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  let backend;
  try {
    backend = new URL(config.origin);
  } catch {
    return new Response(JSON.stringify({ error: "Chat Collab backend origin is invalid." }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const upstream = new URL(request.url);
  upstream.protocol = backend.protocol;
  upstream.host = backend.host;

  const headers = new Headers(request.headers);
  headers.delete("cf-connecting-ip");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) headers.set("x-forwarded-for", clientIp);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstream.toString(), init);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Chat Collab backend is unreachable.",
      }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      },
    );
  }

  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    return upstreamResponse;
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  const location = responseHeaders.get("location");
  if (location) {
    responseHeaders.set("location", rewriteChatwootLocation(location, config.origin, incoming.origin));
  }
  if (typeof responseHeaders.getSetCookie === "function") {
    const cookies = responseHeaders.getSetCookie();
    if (cookies.length) {
      responseHeaders.delete("set-cookie");
      for (const cookie of cookies) {
        responseHeaders.append("set-cookie", rewriteChatwootCookie(cookie));
      }
    }
  }
  responseHeaders.set("x-frame-options", "SAMEORIGIN");
  responseHeaders.delete("content-security-policy");

  const contentType = responseHeaders.get("content-type") || "";
  const contentLength = Number(responseHeaders.get("content-length") || 0);
  if (!shouldRewriteChatwootBody(contentType) || contentLength > 2_000_000) {
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  }

  const text = applyCollabBranding(
    rewriteChatwootPublicUrl(await upstreamResponse.text(), config.origin, incoming.origin),
  );
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  return new Response(text, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
