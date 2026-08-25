import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { lensToPath, resolveDelivereeLens } from "../src/lib/delivereeRoutes";
import { mobileCoreFallbackPath } from "../src/lib/mobileCore";
import {
  chatwootOrigin,
  collabProjectIdFromLocation,
  collabProjectPath,
  isCollabPath,
  isConfiguredCollab,
  productFromPath,
  productHomePath,
} from "../src/lib/collabModule";
import {
  applyCollabBranding,
  collabStatusPayload,
  isCertoCollabBrandPath,
  isChatwootProxyPath,
  provisionCollabSso,
  proxyChatwoot,
  rewriteChatwootCookie,
  rewriteChatwootLocation,
} from "../worker/collab.js";
import worker from "../worker/index.js";

test("Chat Collab is a separate lens from work surfaces", () => {
  assert.deepEqual(resolveDelivereeLens("/collab"), { kind: "collab" });
  assert.deepEqual(resolveDelivereeLens("/collab/c/12"), { kind: "collab" });
  assert.equal(lensToPath({ kind: "collab" }), "/collab");
  assert.equal(isCollabPath("/collab"), true);
  assert.equal(isCollabPath("/home"), false);
  assert.equal(productFromPath("/projects"), "work");
  assert.equal(productFromPath("/collab"), "collab");
  assert.equal(productHomePath("work"), "/home");
  assert.equal(productHomePath("collab"), "/collab");
  assert.equal(collabProjectPath("p1"), "/collab/projects/p1");
  assert.equal(collabProjectIdFromLocation("/collab/projects/p1"), "p1");
  assert.equal(collabProjectIdFromLocation("/collab", "?project=p1"), "p1");
});

test("mobile core does not bounce Chat Collab back to Home", () => {
  assert.equal(mobileCoreFallbackPath("/collab"), null);
  assert.equal(mobileCoreFallbackPath("/home"), null);
});

test("collab status never exposes the Chatwoot platform token or private origin", () => {
  assert.deepEqual(collabStatusPayload({}), {
    configured: false,
    origin: "",
    accountId: "",
    ready: false,
    mount: "same-origin",
  });
  const payload = collabStatusPayload(
    {
      CHATWOOT_URL: "https://chatwoot.internal:3000/",
      CHATWOOT_PLATFORM_TOKEN: "secret-token",
      CHATWOOT_ACCOUNT_ID: "42",
    },
    "https://certo.work/collab",
  );
  assert.equal(payload.configured, true);
  assert.equal(payload.origin, "https://certo.work");
  assert.equal(payload.accountId, "42");
  assert.equal(payload.mount, "same-origin");
  assert.equal(JSON.stringify(payload).includes("secret-token"), false);
  assert.equal(JSON.stringify(payload).includes("chatwoot.internal"), false);
  assert.equal(isConfiguredCollab(payload), true);
  assert.equal(chatwootOrigin("https://certo.work/"), "https://certo.work");
});

test("Chatwoot proxy paths stay on certo.work and do not steal Work routes", () => {
  assert.equal(isChatwootProxyPath("/app"), true);
  assert.equal(isChatwootProxyPath("/app/login"), true);
  assert.equal(isChatwootProxyPath("/auth/sign_in"), true);
  assert.equal(isChatwootProxyPath("/cable"), true);
  assert.equal(isChatwootProxyPath("/api/v1/accounts/1/conversations"), true);
  assert.equal(isChatwootProxyPath("/widget"), true);
  assert.equal(isChatwootProxyPath("/approvals"), false);
  assert.equal(isChatwootProxyPath("/apple"), false);
  assert.equal(isChatwootProxyPath("/home"), false);
  assert.equal(isChatwootProxyPath("/collab"), false);
  assert.equal(isChatwootProxyPath("/__/auth/handler"), false);
  assert.equal(isChatwootProxyPath("/api/collab/status"), false);
  assert.equal(isChatwootProxyPath("/api/boldi/chat"), false);
  assert.equal(isChatwootProxyPath("/widget/apple-token"), false);
  assert.equal(isChatwootProxyPath("/api/widget/apple-token"), false);
});

test("SSO login URLs are rewritten onto the public Certo Work origin", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url);
    calls.push(`${init?.method || "GET"} ${path}`);
    if (path.endsWith("/platform/api/v1/users") && init?.method === "POST") {
      return Response.json({ id: 9, email: "ana@certo.work" });
    }
    if (path.includes("/account_users")) {
      return Response.json({ user_id: 9, role: "administrator" });
    }
    if (path.endsWith("/login")) {
      return Response.json({
        url: "https://chatwoot.internal:3000/app/login?email=ana%40certo.work&sso_auth_token=abc",
      });
    }
    if (path.endsWith("/token") && init?.method === "POST") {
      return Response.json({ access_token: "user-token" });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }) as typeof fetch;
  try {
    const result = await provisionCollabSso(
      {
        CHATWOOT_URL: "https://chatwoot.internal:3000",
        CHATWOOT_PLATFORM_TOKEN: "tok",
        CHATWOOT_ACCOUNT_ID: "7",
      },
      { email: "ana@certo.work", displayName: "Ana", userId: "uid-1", workspaceId: "ws-1" },
      "https://certo.work",
    );
    assert.equal(result.url, "https://certo.work/app");
    assert.equal(
      result.loginUrl,
      "https://certo.work/app/login?email=ana%40certo.work&sso_auth_token=abc",
    );
    assert.equal(result.userId, 9);
    assert.ok(calls.includes("POST https://chatwoot.internal:3000/platform/api/v1/users"));
    assert.ok(calls.includes("POST https://chatwoot.internal:3000/platform/api/v1/accounts/7/account_users"));
    assert.ok(calls.includes("GET https://chatwoot.internal:3000/platform/api/v1/users/9/login"));
    assert.ok(calls.includes("POST https://chatwoot.internal:3000/platform/api/v1/users/9/token"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("SSO creates project rooms and rewrites the desk onto certo.work", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/platform/api/v1/users") && init?.method === "POST") {
      return Response.json({ id: 9, email: "ana@certo.work" });
    }
    if (path.includes("/account_users")) {
      const body = JSON.parse(String(init?.body || "{}"));
      assert.equal(body.role, "administrator");
      return Response.json({ user_id: 9, role: "administrator" });
    }
    if (path.endsWith("/login")) {
      return Response.json({
        url: "https://chatwoot.internal:3000/app/login?email=ana%40certo.work&sso_auth_token=abc",
      });
    }
    if (path.endsWith("/token") && init?.method === "POST") {
      return Response.json({ access_token: "user-token" });
    }
    if (path.endsWith("/inboxes") && init?.method === "POST") {
      return Response.json({ id: 21, name: "Room · Atlas" });
    }
    if (path.endsWith("/inboxes")) {
      return Response.json({ payload: [] });
    }
    if (path.includes("/contacts/search")) {
      return Response.json({ payload: [] });
    }
    if (path.endsWith("/contacts") && init?.method === "POST") {
      return Response.json({ payload: { contact: { id: 31, identifier: "certo:project:p1" } } });
    }
    if (path.includes("/conversations") && init?.method === "POST") {
      return Response.json({ id: 41, display_id: 4 });
    }
    if (path.includes("/conversations")) {
      return Response.json({ data: { payload: [] } });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }) as typeof fetch;
  try {
    const result = await provisionCollabSso(
      {
        CHATWOOT_URL: "https://chatwoot.internal:3000",
        CHATWOOT_PLATFORM_TOKEN: "tok",
        CHATWOOT_ACCOUNT_ID: "7",
      },
      {
        email: "ana@certo.work",
        displayName: "Ana",
        userId: "uid-1",
        workspaceId: "ws-1",
        projectId: "p1",
        projects: [{ id: "p1", name: "Atlas" }],
      },
      "https://certo.work",
    );
    assert.equal(result.url, "https://certo.work/app");
    assert.equal(result.roomUrl, "https://certo.work/app/accounts/7/conversations/4");
    assert.equal(result.rooms?.[0]?.projectId, "p1");
    assert.equal(result.rooms?.[0]?.path, "/app/accounts/7/conversations/4");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("proxy rewrites Chatwoot redirects and cookies onto certo.work", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    assert.equal(String(url), "https://chatwoot.internal:3000/app/login?sso_auth_token=abc");
    return new Response("<html>https://chatwoot.internal:3000/app</html>", {
      status: 302,
      headers: {
        "content-type": "text/html; charset=utf-8",
        location: "https://chatwoot.internal:3000/app/accounts/7/dashboard",
        "set-cookie": "cw_d_session_info=abc; Domain=chatwoot.internal; Path=/",
      },
    });
  }) as typeof fetch;
  try {
    const response = await proxyChatwoot(
      new Request("https://certo.work/app/login?sso_auth_token=abc"),
      { CHATWOOT_URL: "https://chatwoot.internal:3000" },
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://certo.work/app/accounts/7/dashboard");
    assert.equal(response.headers.get("set-cookie"), "cw_d_session_info=abc; Path=/");
    assert.equal(await response.text(), "<html>https://certo.work/app</html>");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("worker serves Chatwoot from certo.work and leaves Work routes on the SPA", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).startsWith("https://chatwoot.internal:3000/app")) {
      return new Response("desk", { headers: { "content-type": "text/html" } });
    }
    return new Response("missing", { status: 404 });
  }) as typeof fetch;
  try {
    const env = {
      ASSETS: {
        async fetch(request: Request) {
          const pathname = new URL(request.url).pathname;
          if (pathname === "/approvals") {
            return new Response("work-spa", { headers: { "content-type": "text/html" } });
          }
          if (pathname === "/certo-mark.svg") {
            return new Response("<svg id='certo-mark'></svg>", {
              headers: { "content-type": "image/svg+xml" },
            });
          }
          return new Response("missing", { status: 404 });
        },
      },
      CHATWOOT_URL: "https://chatwoot.internal:3000",
      CHATWOOT_PLATFORM_TOKEN: "tok",
      CHATWOOT_ACCOUNT_ID: "7",
    };
    const proxied = await worker.fetch(new Request("https://certo.work/app/login"), env);
    assert.equal(proxied.status, 200);
    assert.equal(await proxied.text(), "desk");
    const work = await worker.fetch(new Request("https://certo.work/approvals"), env);
    assert.equal(await work.text(), "work-spa");
    const logo = await worker.fetch(new Request("https://certo.work/brand-assets/logo.svg"), env);
    assert.equal(logo.headers.get("content-type"), "image/svg+xml");
    assert.equal(await logo.text(), "<svg id='certo-mark'></svg>");
    const status = await worker.fetch(new Request("https://certo.work/api/collab/status"), env);
    assert.deepEqual(await status.json(), {
      configured: true,
      origin: "https://certo.work",
      accountId: "7",
      ready: true,
      mount: "same-origin",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("SSO can return the desk before project rooms are synced", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url);
    calls.push(`${init?.method || "GET"} ${path}`);
    if (path.endsWith("/platform/api/v1/users") && init?.method === "POST") {
      return Response.json({ id: 9, email: "ana@certo.work" });
    }
    if (path.includes("/account_users")) {
      return Response.json({ user_id: 9, role: "administrator" });
    }
    if (path.endsWith("/login")) {
      return Response.json({
        url: "https://chatwoot.internal:3000/app/login?email=ana%40certo.work&sso_auth_token=abc",
      });
    }
    if (path.includes("/platform/api/v1/users/9") && init?.method === "PATCH") {
      return Response.json({ id: 9 });
    }
    if (path.includes("/accounts/7") && init?.method === "PATCH") {
      return Response.json({ id: 7 });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }) as typeof fetch;
  try {
    const result = await provisionCollabSso(
      {
        CHATWOOT_URL: "https://chatwoot.internal:3000",
        CHATWOOT_PLATFORM_TOKEN: "tok",
        CHATWOOT_ACCOUNT_ID: "7",
      },
      { email: "ana@certo.work", displayName: "Ana", company: "Certo", userId: "uid-1", workspaceId: "ws-1" },
      "https://certo.work",
      { syncRooms: false },
    );
    assert.equal(
      result.url,
      "https://certo.work/app",
    );
    assert.equal(
      result.loginUrl,
      "https://certo.work/app/login?email=ana%40certo.work&sso_auth_token=abc",
    );
    assert.equal(result.rooms.length, 0);
    assert.equal(calls.some((item) => item.includes("/inboxes")), false);
    assert.equal(calls.some((item) => item.includes("/token")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Chatwoot HTML is branded as Certo Work and project rooms can collapse", () => {
  const html = applyCollabBranding(`<!DOCTYPE html><html><head>
    <title>Chatwoot</title>
    <link href="/brand-assets/logo_thumbnail.svg">
    <script>window.globalConfig = {"LOGO":"/brand-assets/logo.svg","LOGO_DARK":"/brand-assets/logo_dark.svg","LOGO_THUMBNAIL":"/brand-assets/logo_thumbnail.svg","INSTALLATION_NAME":"Chatwoot","BRAND_NAME":"Chatwoot"}</script>
    </head><body>Room · Atlas</body></html>`);
  assert.match(html, /<title>Certo Work<\/title>/);
  assert.match(html, /"INSTALLATION_NAME":"Certo Work"/);
  assert.match(html, /\/certo-mark\.svg/);
  assert.match(html, /certo-collab-brand/);
  assert.match(html, /Search project rooms/);
  assert.match(html, /data-certo-channel-children/);
  assert.match(html, /data-certo-sidebar-nav/);
  assert.match(html, /Project rooms/);
  assert.match(html, /Other channels/);
  assert.match(html, /#app \{ overflow: hidden !important; \}/);
  assert.doesNotMatch(html, /max-height: min\(56vh, 32rem\)/);
  assert.equal(isCertoCollabBrandPath("/brand-assets/logo.svg"), true);
  assert.equal(isCertoCollabBrandPath("/app"), false);
});

test("location and cookie helpers never emit a collab subdomain", () => {
  assert.equal(
    rewriteChatwootLocation(
      "https://chatwoot.internal:3000/app/login",
      "https://chatwoot.internal:3000",
      "https://certo.work",
    ),
    "https://certo.work/app/login",
  );
  assert.equal(rewriteChatwootCookie("session=1; Domain=collab.certo.work; Path=/"), "session=1; Path=/");
});

test("Chatwoot brand-asset paths are handled by the Worker before the SPA", () => {
  const wrangler = readFileSync(resolve("wrangler.jsonc"), "utf8");
  assert.match(wrangler, /\/brand-assets\/\*/);
});

test("live shell mounts Chat Collab as a separate product on certo.work", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const collab = readFileSync(resolve("src/components/ChatCollabModule.tsx"), "utf8");
  assert.match(workspace, /ProductSwitcher/);
  assert.match(workspace, /ChatCollabModule/);
  assert.match(workspace, /data-testid="header-collab"/);
  assert.match(workspace, /nav-collab/);
  assert.match(workspace, /CertoMark/);
  assert.match(workspace, /do-product-pane/);
  assert.match(workspace, /collabOpened/);
  assert.match(workspace, /warmCollabSession/);
  assert.match(collab, /data-testid="chat-collab-module"/);
  assert.match(collab, /data-testid="chat-collab-setup"/);
  assert.match(collab, /data-testid="chat-collab-frame"/);
  assert.match(collab, /openCollabDesk/);
  assert.match(collab, /["']\/app["']/);
  assert.match(collab, /syncCollabRooms/);
  assert.doesNotMatch(collab, /do-collab-nav/);
  assert.doesNotMatch(collab, /1800/);
  assert.match(collab, /certo\.work/);
  assert.equal(collab.includes("collab.certo.work"), false);
});

test("existing Chatwoot cookies open the desk without a login URL", async () => {
  const originalFetch = globalThis.fetch;
  const { openCollabDesk } = await import("../src/lib/collabClient");
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    const path = String(url);
    calls.push(path);
    if (path.endsWith("/api/v1/profile")) return new Response("{}", { status: 200 });
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;
  try {
    const result = await openCollabDesk({
      token: "t",
      userId: "uid-1",
      workspaceId: "ws-1",
      email: "ana@certo.work",
      displayName: "Ana",
    });
    assert.equal(result.url, "/app");
    assert.equal(calls.some((item) => item.includes("/api/collab/sso")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
