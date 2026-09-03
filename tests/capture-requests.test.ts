import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildPersonalCaptureEmail,
  buildTeamCaptureEmail,
  buildRequestPortalSnapshot,
  buildTicketSlaPatch,
  deterministicCaptureUnderstand,
  deterministicTicketTriage,
  isCapturedWorkItem,
  mapTicketStatusToWorkStatus,
  markTicketFirstResponseSla,
  requestPortalPath,
  toCustomerStatus,
} from "../src/lib/captureRequests";
import { allowedParentKinds } from "../src/lib/itemHierarchy";
import { filterMyWorkTasks } from "../src/lib/myWorkItems";
import { resolveDelivereeLens } from "../src/lib/delivereeRoutes";
import {
  briefTicketReplyEmail,
  createCaptureRequestsHandlers,
  deterministicCaptureUnderstand as workerUnderstand,
} from "../worker/captureRequests.js";

test("capture addresses use Certo domains", () => {
  assert.equal(buildPersonalCaptureEmail("alejandro"), "alejandro@in.certo.work");
  assert.equal(buildTeamCaptureEmail("platform"), "platform@requests.certo.work");
});

test("deterministic capture understands actionable email", () => {
  const result = deterministicCaptureUnderstand({
    subject: "Please review the Q3 plan by Friday",
    body: "Can you take a look at the attached plan ASAP?",
  });
  assert.equal(result.intent, "ACTION_REQUIRED");
  assert.equal(result.workItemSuggestion, "pbi");
  assert.match(result.title, /Q3 plan|Review/i);
});

test("ticket triage marks outages as priority 1", () => {
  const triage = deterministicTicketTriage({
    subject: "Production is down",
    body: "Users cannot login",
  });
  assert.equal(triage.priority, "1");
  assert.equal(triage.category, "access");
});

test("tickets have no hierarchy parents", () => {
  assert.deepEqual(allowedParentKinds("ticket"), []);
});

test("captured section filters capture-sourced items", () => {
  const actor = { userId: "u1", memberId: "m1", email: "a@example.com" };
  const items = [
    {
      id: "1",
      title: "From email",
      source: "capture",
      createdBy: "u1",
      userId: "u1",
      assigneeIds: ["m1"],
    },
    {
      id: "2",
      title: "Manual",
      source: "manual",
      createdBy: "u1",
      userId: "u1",
      assigneeIds: ["m1"],
    },
  ];
  assert.equal(isCapturedWorkItem(items[0]), true);
  const captured = filterMyWorkTasks(items, "captured", actor, []);
  assert.deepEqual(captured.map((item) => item.id), ["1"]);
});

test("routes resolve capture and requests lenses", () => {
  assert.deepEqual(resolveDelivereeLens("/my-work/captured"), {
    kind: "my-work",
    section: "captured",
  });
  assert.deepEqual(resolveDelivereeLens("/requests"), {
    kind: "requests",
    section: "inbox",
  });
  assert.deepEqual(resolveDelivereeLens("/requests/waiting"), {
    kind: "requests",
    section: "waiting",
  });
});

test("customer status stays non-technical", () => {
  assert.equal(toCustomerStatus({ ticketStatus: "waiting", waitingReason: "Waiting for requester" }), "Waiting on you");
  assert.equal(mapTicketStatusToWorkStatus("resolved"), "done");
});

test("Brevo reply email stays brief", () => {
  const content = briefTicketReplyEmail({
    ticketTitle: "Login issue",
    ticketKey: "REQ-12",
    body: "We fixed the reset link. Try again.",
    workspaceName: "Certo Work",
    portalUrl: "https://certo.work/request/abc",
  });
  assert.match(content.subject, /REQ-12/);
  assert.match(content.textContent, /We fixed the reset link/);
  assert.match(content.textContent, /Track status/);
  assert.doesNotMatch(content.textContent, /Onboarding checklist|long narrative/i);
  assert.ok(content.textContent.length < 500);
  assert.equal(requestPortalPath("abc"), "/request/abc");
});

test("worker capture understand endpoint is offline-safe", async () => {
  const calls: any[] = [];
  const handlers = createCaptureRequestsHandlers({
    json: (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
      }),
    readJson: async () => ({
      userId: "u1",
      workspaceId: "w1",
      subject: "Please send the report",
      body: "Need this by Friday",
    }),
    authorize: async () => ({ uid: "u1" }),
    sendBrevoTransactionalEmail: async (...args: unknown[]) => {
      calls.push(args);
      return { sent: true, configured: true, messageId: "msg-1" };
    },
  });
  const response = await handlers.handleUnderstand(
    new Request("https://certo.work/api/capture/understand", { method: "POST" }),
    {},
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.understood.intent, "ACTION_REQUIRED");
});

test("worker request reply sends through Brevo", async () => {
  const sent: any[] = [];
  const handlers = createCaptureRequestsHandlers({
    json: (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
      }),
    readJson: async () => ({
      userId: "u1",
      workspaceId: "w1",
      toEmail: "customer@example.com",
      body: "Done — please confirm.",
      ticketTitle: "Access",
      ticketKey: "REQ-1",
    }),
    authorize: async () => ({ uid: "u1" }),
    sendBrevoTransactionalEmail: async (_env: unknown, message: unknown) => {
      sent.push(message);
      return { sent: true, configured: true, messageId: "brevo-1" };
    },
  });
  const response = await handlers.handleTicketReply(
    new Request("https://certo.work/api/requests/reply", { method: "POST" }),
    { BREVO_API_KEY: "test", CERTO_EMAIL_FROM: "requests@certo.work" },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(sent.length, 1);
  assert.match(String((sent[0] as any).textContent), /Done — please confirm/);
});

test("workspace wires Requests nav and Capture settings", () => {
  const source = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(source, /data-testid="nav-requests"/);
  assert.match(source, /data-testid="my-work-captured-tab"/);
  assert.match(source, /CaptureSettingsPanel/);
  assert.match(source, /\/api\/requests\/reply/);
  assert.match(source, /RequestsCenter/);
  assert.match(source, /REQUEST_PORTAL_COLLECTION/);
  assert.match(source, /requestPortalAbsoluteUrl/);
});

test("requester portal route is public and token-based", () => {
  const app = readFileSync(resolve("src/App.tsx"), "utf8");
  const portal = readFileSync(resolve("src/components/PublicRequestPortal.tsx"), "utf8");
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  assert.match(app, /PublicRequestPortal/);
  assert.match(app, /requestPortalToken/);
  assert.match(app, /\\\/request\\\//);
  assert.match(portal, /data-testid="request-portal"/);
  assert.match(portal, /request-portal-reply/);
  assert.match(portal, /onSnapshot/);
  assert.match(rules, /match \/request_portal_tokens\/\{id\}/);
  assert.match(rules, /channel == 'portal'/);
  assert.match(rules, /match \/capture_routes\/\{id\}/);
});

test("SLA helpers set first response and next update clocks", () => {
  const sla = buildTicketSlaPatch(Date.parse("2026-09-03T10:00:00.000Z"));
  assert.ok(sla.firstResponseDueAt);
  assert.ok(sla.nextUpdateDueAt);
  const marked = markTicketFirstResponseSla({ sla }, Date.parse("2026-09-03T11:00:00.000Z"));
  assert.equal(marked.firstRespondedAt, "2026-09-03T11:00:00.000Z");
});

test("workspace wires core requests polish", () => {
  const source = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const requests = readFileSync(resolve("src/components/RequestsCenter.tsx"), "utf8");
  assert.match(source, /ensureRequestPortal/);
  assert.match(source, /ensureTeamCaptureAddress/);
  assert.match(source, /buildTicketSlaPatch/);
  assert.match(requests, /requests-waiting-reason/);
  assert.match(requests, /onOpenRelatedWork/);
});

test("portal snapshot only exposes public customer fields", () => {
  const snapshot = buildRequestPortalSnapshot({
    workspaceName: "Acme",
    ticket: {
      id: "t1",
      title: "Cannot login",
      description: "Reset failed",
      ticketStatus: "waiting",
      waitingReason: "Waiting for requester",
      requesterEmail: "pat@example.com",
      relatedWorkIds: ["secret-eng-id"],
      ai: { notes: "internal" },
    },
    messages: [
      {
        id: "m1",
        workItemId: "t1",
        visibility: "public",
        body: "Please try again",
        authorName: "Team",
        channel: "app",
      },
      {
        id: "m2",
        workItemId: "t1",
        visibility: "internal",
        body: "Check auth logs",
        authorName: "Dev",
        channel: "app",
      },
    ],
  });
  assert.equal(snapshot.ticket.customerStatus, "Waiting on you");
  assert.equal(snapshot.messages.length, 1);
  assert.equal(snapshot.messages[0].body, "Please try again");
  assert.equal((snapshot.ticket as any).relatedWorkIds, undefined);
  assert.equal((snapshot.ticket as any).ai, undefined);
});

test("worker understand matches client helper", () => {
  const input = { subject: "FYI: weekly note", body: "No action needed" };
  assert.equal(workerUnderstand(input).intent, deterministicCaptureUnderstand(input).intent);
});

test("worker understand can use OpenAI dependency when provided", async () => {
  const handlers = createCaptureRequestsHandlers({
    json: (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
      }),
    readJson: async () => ({
      userId: "u1",
      workspaceId: "w1",
      subject: "Need approval",
      body: "Please approve the change",
    }),
    authorize: async () => ({ uid: "u1" }),
    sendBrevoTransactionalEmail: async () => ({ sent: false, configured: false }),
    openaiUnderstand: async () => ({
      provider: "openai",
      understood: {
        intent: "DECISION",
        title: "Approve the change",
        description: { context: "Approval needed", outcome: "Decision", details: "" },
        workItemSuggestion: "pbi",
        fields: {},
        duplicateOfId: null,
      },
    }),
  });
  const response = await handlers.handleUnderstand(
    new Request("https://certo.work/api/capture/understand", { method: "POST" }),
    {},
  );
  const body = await response.json();
  assert.equal(body.provider, "openai");
  assert.equal(body.understood.intent, "DECISION");
  assert.equal(body.understood.title, "Approve the change");
});

test("finish gaps wire portal task update, understand API, team list, express parity", () => {
  const portal = readFileSync(resolve("src/components/PublicRequestPortal.tsx"), "utf8");
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const settings = readFileSync(resolve("src/components/CaptureSettingsPanel.tsx"), "utf8");
  const server = readFileSync(resolve("server.ts"), "utf8");
  const worker = readFileSync(resolve("worker/index.js"), "utf8");
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  assert.match(portal, /ticketStatus:\s*"in_progress"/);
  assert.match(rules, /portalToken/);
  assert.match(workspace, /\/api\/capture\/understand/);
  assert.match(workspace, /teamCaptureAddresses/);
  assert.match(workspace, /capture_routes.*aliasEmail|aliasEmail[\s\S]*capture_routes/);
  assert.match(settings, /capture-team-list/);
  assert.match(server, /\/api\/capture\/triage/);
  assert.match(server, /\/api\/capture\/inbound\/email/);
  assert.match(worker, /openaiCaptureUnderstand/);
  assert.match(worker, /openaiUnderstand:\s*openaiCaptureUnderstand/);
});
