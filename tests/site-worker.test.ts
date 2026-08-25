import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  assistantInstructions,
  firebaseAuthProxyUrl,
  inferProjectTitleFromRequest,
  magicProjectInstructions,
  normalizeConversationMessages,
  rewriteFirebaseAuthLocation,
  rewriteInstructions,
} from "../worker/index.js";
import { collabStatusPayload } from "../worker/collab.js";

function environment(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: {
      async fetch(request: Request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/" || pathname === "/index.html") {
          return new Response("<!doctype html><title>Certo Work</title>", {
            headers: { "content-type": "text/html" },
          });
        }
        return new Response("missing", { status: 404 });
      },
    },
    ...overrides,
  };
}

function bridgeDatabase() {
  return {
    prepare(sql: string) {
      return {
        sql,
        bind() { return this; },
        async run() { return { meta: { changes: 1 } }; },
        async first() { return null; },
        async all() { return { results: [] }; },
      };
    },
    async batch(statements: unknown[]) { return statements.map(() => ({ success: true })); },
  };
}

test("Sites worker reports an offline-safe health state without an API key", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/health"),
    environment(),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as any;
  assert.equal(body.ok, true);
  assert.equal(body.service, "delivereeos-codex-sites");
  assert.equal(body.aiProvider, "offline-safe");
  assert.equal(body.ai.providerConfigured, false);
  assert.equal(body.ai.safeMode, true);
  assert.equal(body.ai.connectionStatus, "not_configured");
});

test("AI health never returns the OpenAI secret", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/ai/health"),
    environment({ OPENAI_API_KEY: "sk-secret-value", OPENAI_MODEL: "gpt-test" }),
  );
  const body = (await response.json()) as any;
  const serialized = JSON.stringify(body);
  assert.equal(body.providerConfigured, true);
  assert.equal(body.model, "gpt-test");
  assert.equal(body.safeMode, false);
  assert.equal(serialized.includes("sk-secret-value"), false);
});

test("Firebase auth helpers are resolved through the legacy Firebase host", () => {
  assert.equal(
    firebaseAuthProxyUrl(
      "https://gazelle-boldr-ai.boldrai-3640.chatgpt.site/__/auth/handler?providerId=google.com",
    ),
    "https://gen-lang-client-0277783597.firebaseapp.com/__/auth/handler?providerId=google.com",
  );
});

test("Chat Collab status is public and unconfigured by default", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/collab/status"),
    environment(),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), collabStatusPayload({}, "https://gazelle.test"));
});

test("Chat Collab SSO requires authentication", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/collab/sso", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    environment(),
  );
  assert.equal(response.status, 401);
});

test("Firebase auth redirects stay on the public Certo Work origin", () => {
  assert.equal(
    rewriteFirebaseAuthLocation(
      "https://gen-lang-client-0277783597.firebaseapp.com/__/auth/handler?state=abc",
      "https://certo.work/__/auth/handler",
    ),
    "https://certo.work/__/auth/handler?state=abc",
  );
  assert.equal(
    rewriteFirebaseAuthLocation(
      "https://gen-lang-client-0277783597.web.app/__/auth/iframe?apiKey=test",
      "https://certo.work/__/auth/iframe",
    ),
    "https://certo.work/__/auth/iframe?apiKey=test",
  );
});

test("Sites worker truthfully disables Google AI Studio", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/capabilities"),
    environment(),
  );
  const body = (await response.json()) as any;
  assert.equal(body.gemini.configured, false);
  assert.match(body.gemini.description, /not used/i);
  assert.equal(body.activeAIProvider.configured, false);
  assert.equal(body.email.configured, false);
});

test("workspace invite email route requires authentication", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/email/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        workspaceId: "workspace-1",
        workspaceName: "Certo Work",
        toEmail: "team@example.com",
        role: "member",
      }),
    }),
    environment(),
  );
  assert.equal(response.status, 401);
});

test("Sites worker exposes the signed-in platform identity for the migration path", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/session", {
      headers: {
        "oai-authenticated-user-id": "sites-user-1",
        "oai-authenticated-user-email": "alejandro@getboldr.ai",
        "oai-authenticated-user-full-name": "Alejandro%20Pascual",
        "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
      },
    }),
    environment(),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: true,
    provider: "codex-sites",
    user: {
      id: "sites-user-1",
      email: "alejandro@getboldr.ai",
      name: "Alejandro Pascual",
    },
  });
});

test("Sites session endpoint rejects anonymous requests", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/session"),
    environment(),
  );
  assert.equal(response.status, 401);
});

test("Codex bridge exposes its scoped MCP tools only to the signed-in platform user", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/mcp/delivereeos", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-id": "sites-user-1",
        "oai-authenticated-user-email": "alejandro@getboldr.ai",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }),
    environment({ DB: bridgeDatabase() }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as any;
  assert.equal(body.result.tools[0].name, "list_delivery_links");
  assert.equal(body.result.tools.at(-1).name, "report_project_gap");
});

test("Codex bridge rejects anonymous MCP calls", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/mcp/delivereeos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }),
    environment({ DB: bridgeDatabase() }),
  );
  assert.equal(response.status, 401);
});

test("Sites worker preserves client-side routes through the SPA fallback", async () => {
  const requestedPaths: string[] = [];
  const env = environment({
    ASSETS: {
      async fetch(request: Request) {
        const url = new URL(request.url);
        requestedPaths.push(`${url.pathname}${url.search}`);
        if (url.pathname === "/" && url.searchParams.get("gazelle-spa") === "1") {
          return new Response("<!doctype html><title>Certo Work</title>", {
            headers: { "content-type": "text/html" },
          });
        }
        return Response.redirect("https://gazelle.test/", 307);
      },
    },
  });
  const response = await worker.fetch(
    new Request("https://gazelle.test/work/projects", {
      headers: { accept: "text/html" },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Certo Work/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(requestedPaths, ["/?gazelle-spa=1"]);
});

test("Boldi compatibility route rejects unauthenticated requests", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/boldi/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        workspaceId: "workspace-1",
        messages: [{ role: "user", content: "Plan my week" }],
      }),
    }),
    environment(),
  );
  assert.equal(response.status, 401);
});

test("inline AI rewriting preserves facts and rejects anonymous requests", async () => {
  const instructions = rewriteInstructions("work_item_title", { project: "KruOps" });
  assert.match(instructions, /Preserve all facts, names, dates, amounts, metrics/);
  assert.match(instructions, /strong action verb/);
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/certo/rewrite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        workspaceId: "workspace-1",
        fieldKind: "work_item_title",
        text: "fix login",
      }),
    }),
    environment(),
  );
  assert.equal(response.status, 401);
});

test("magic project extraction rejects anonymous requests and asks for JSON structure", async () => {
  const instructions = magicProjectInstructions();
  assert.match(instructions, /kickoff/i);
  assert.match(instructions, /successCriteria/);
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/certo/magic-project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        workspaceId: "workspace-1",
        text: "# Pilot\nOutcome: Prove assignment.",
      }),
    }),
    environment(),
  );
  assert.equal(response.status, 401);
});

test("project conversations use delivery-team behavior instead of Odysseus lecturing", () => {
  const instructions = assistantInstructions(
    {
      workspaceContext: {
        mode: "focused_delivery",
        activeProject: { id: "fieldops", title: "FieldOps" },
        contextProjects: [{ id: "fieldops", title: "FieldOps" }],
        currentUserMessageId: "message-prd",
        projectArtifactSourceMessageId: "previous-message-prd",
        tasks: Array.from({ length: 15 }, () => ({ status: "open" })),
        projects: [{ id: "fieldops", title: "FieldOps" }],
        documents: [],
      },
    },
    [],
  );

  assert.match(instructions, /FOCUSED DELIVERY MODE/);
  assert.match(instructions, /Missing information is a completion checklist, not a refusal/);
  assert.match(instructions, /Never respond with only a gate, lecture, or request to pause another project/);
  assert.match(instructions, /create_project_artifact/);
  assert.match(instructions, /previous-message-prd/);
  assert.match(instructions, /attached_entities_only/);
});

test("Odysseus can route an approved handoff to an existing conversation", () => {
  const instructions = assistantInstructions(
    {
      workspaceContext: {
        mode: "personal_home",
        conversationDirectory: [{ id: "fieldops-chat", title: "FieldOps delivery", scope: "FieldOps" }],
        tasks: [],
        projects: [],
      },
    },
    [],
  );

  assert.match(instructions, /ODISEUS MODE/);
  assert.match(instructions, /personal Home conversation for this user/);
  assert.match(instructions, /this user's personal AI employee/);
  assert.match(instructions, /not a shared workspace bot/);
  assert.match(instructions, /post_to_conversation/);
  assert.match(instructions, /fieldops-chat/);
  assert.match(instructions, /Never invent a conversation ID/);
  assert.match(instructions, /personal_home/);
});

test("voice conversation asks Odysseus to listen and wrap up into tasks", () => {
  const live = assistantInstructions(
    {
      workspaceContext: {
        mode: "personal_home",
        voiceSession: true,
        tasks: [],
        projects: [],
      },
    },
    [],
  );
  assert.match(live, /VOICE CONVERSATION/);
  assert.match(live, /quiet assistant taking notes/);
  const wrap = assistantInstructions(
    {
      workspaceContext: {
        mode: "personal_home",
        voiceSession: true,
        voiceWrapUp: true,
        tasks: [],
        projects: [],
      },
    },
    [],
  );
  assert.match(wrap, /VOICE WRAP-UP/);
});

test("the current pasted PRD and the latest prior PRD remain available for follow-up", () => {
  const prd = "P".repeat(120_000);
  const olderPrd = "O".repeat(30_000);
  const normalized = normalizeConversationMessages([
    { role: "user", content: olderPrd },
    { role: "assistant", content: "older acknowledgement" },
    { role: "user", content: prd },
    { role: "assistant", content: "acknowledged" },
    { role: "user", content: "Add the PRD from my previous message to FieldOps" },
  ]);

  assert.equal(normalized[0].content.length, 16_000);
  assert.equal(normalized[2].content.length, prd.length);
  assert.equal(normalized.at(-1)?.content, "Add the PRD from my previous message to FieldOps");
});

test("create project requests keep the explicit project name instead of the generic command", () => {
  assert.equal(
    inferProjectTitleFromRequest("Please create a project called KruOps Field Operations and add the PRD."),
    "KruOps Field Operations",
  );
  assert.equal(
    inferProjectTitleFromRequest("crear un proyecto para Castillo Retail Pilot con Scrum"),
    "Castillo Retail Pilot",
  );
  assert.equal(inferProjectTitleFromRequest("create a project"), "");
});
