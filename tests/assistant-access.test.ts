import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assistantAccessEnabled,
  dispatchAssistantRequest,
  listWorkItems,
  projectWorkItem,
  sha256Hex,
} from "../worker/assistantAccessCore.js";
import { handleAssistantWorkerRequest } from "../worker/assistantAccess.js";
import { categoriesVisibleInWorkspace, controlledOptions, isOpaqueCatalogId } from "../src/lib/controlledLists";
import { dedupeTagsByName, tagLabels, toggleTagWithCatalog } from "../src/lib/tagging";
import { findWorkItemById, retainFocusForOpen } from "../src/lib/openWorkItem";
import { applyStoreUpdate } from "../src/data/applyStoreUpdate";
import { createDocStore } from "../src/data/createDocStore";

const ENABLED = { ASSISTANT_ACCESS_ENABLED: "1" };

function memoryRepo() {
  const state = {
    members: new Set(["user-a:ws-a", "user-a:ws-b", "user-b:ws-b"]),
    tokens: [] as any[],
    items: [
      {
        id: "item-1",
        workspaceId: "ws-a",
        userId: "user-a",
        title: "Old name",
        status: "open",
        priority: 2,
        dueDate: "2026-10-20",
        assigneeIds: ["mem-1"],
        assignees: ["Ada"],
        parentId: "feature-1",
        epicId: "epic-1",
        featureId: "feature-1",
        workItemType: "pbi",
        deliveryEntity: "Studio",
        clientEntity: "Northwind",
        tagIds: ["tag-1"],
        description: "Ship the API",
        externalRef: "asana:1",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-02T00:00:00.000Z",
      },
      {
        id: "item-2",
        workspaceId: "ws-a",
        title: "Later",
        status: "open",
        workItemType: "epic",
        createdAt: "2026-10-03T00:00:00.000Z",
        updatedAt: "2026-10-04T00:00:00.000Z",
      },
      {
        id: "secret-other",
        workspaceId: "ws-b",
        title: "Other tenant",
        status: "open",
        createdAt: "2026-10-05T00:00:00.000Z",
        updatedAt: "2026-10-06T00:00:00.000Z",
      },
    ],
    tags: [{ id: "tag-1", name: "Product", workspaceId: "ws-a", group: "tag" }],
    proposals: [] as any[],
    audits: [] as any[],
    writes: [] as string[],
  };
  return {
    state,
    async isMember(userId: string, workspaceId: string) {
      return state.members.has(`${userId}:${workspaceId}`);
    },
    async listTokensForUser(userId: string) {
      return state.tokens.filter((token) => token.userId === userId);
    },
    async saveToken(record: any) {
      state.tokens.push(record);
    },
    async getToken(id: string) {
      return state.tokens.find((token) => token.id === id) || null;
    },
    async findTokenByHash(hash: string) {
      return state.tokens.find((token) => token.tokenHash === hash) || null;
    },
    async patchToken(id: string, patch: any) {
      const token = state.tokens.find((entry) => entry.id === id);
      if (token) Object.assign(token, patch);
    },
    async listItems() {
      return state.items;
    },
    async getItem(workspaceId: string, itemId: string) {
      const item = state.items.find((entry) => entry.id === itemId) || null;
      if (!item || item.workspaceId !== workspaceId) return null;
      return item;
    },
    async listTags(workspaceId: string) {
      return state.tags.filter((tag) => tag.workspaceId === workspaceId);
    },
    async saveProposal(record: any) {
      state.proposals.push(record);
      state.writes.push("proposal");
    },
    async listProposals(userId: string) {
      return state.proposals.filter((proposal) => proposal.userId === userId);
    },
    async getProposal(id: string) {
      return state.proposals.find((proposal) => proposal.id === id) || null;
    },
    async patchProposal(id: string, patch: any) {
      const proposal = state.proposals.find((entry) => entry.id === id);
      if (proposal) Object.assign(proposal, patch);
    },
    async createItem(data: any) {
      const id = `created-${state.items.length + 1}`;
      state.items.push({ ...data, id });
      state.writes.push("createItem");
      return { id };
    },
    async updateItem(workspaceId: string, itemId: string, patch: any) {
      const item = state.items.find((entry) => entry.id === itemId && entry.workspaceId === workspaceId);
      if (!item) throw Object.assign(new Error("missing"), { status: 404, code: "not_found" });
      Object.assign(item, patch);
      state.writes.push("updateItem");
    },
    async writeAudit(event: any) {
      state.audits.push(event);
    },
  };
}

function call(repo: ReturnType<typeof memoryRepo>, request: Record<string, unknown>, now = Date.parse("2026-10-11T00:00:00.000Z")) {
  return dispatchAssistantRequest(request, {
    env: ENABLED,
    repo,
    now: () => now,
    verifyUser: async (token: string) => {
      if (token === "firebase-user-a") return { uid: "user-a", email: "a@example.com" };
      if (token === "firebase-user-b") return { uid: "user-b", email: "b@example.com" };
      throw new Error("bad token");
    },
  });
}

async function issueToken(repo: ReturnType<typeof memoryRepo>, scopes: string[] = ["items:read"], workspaceIds = ["ws-a"]) {
  const created = await call(repo, {
    method: "POST",
    path: "/api/assistant/tokens",
    headers: { authorization: "Bearer firebase-user-a" },
    body: { label: "Assistant", workspaceIds, scopes, expiresInDays: 30 },
  });
  assert.equal(created.status, 201);
  return created.body.token as string;
}

test("assistant access stays disabled unless the server flag is on", async () => {
  assert.equal(assistantAccessEnabled({}), false);
  assert.equal(assistantAccessEnabled({ ASSISTANT_ACCESS_ENABLED: "0" }), false);
  assert.equal(assistantAccessEnabled({ ASSISTANT_ACCESS_ENABLED: "1" }), true);
  const repo = memoryRepo();
  const disabled = await dispatchAssistantRequest(
    { method: "GET", path: "/api/assistant/items", query: { workspaceId: "ws-a" }, headers: {} },
    { env: {}, repo, verifyUser: async () => ({ uid: "user-a" }) },
  );
  assert.equal(disabled.status, 404);
  assert.equal(disabled.body.code, "assistant_access_disabled");
  assert.equal(repo.state.audits.length, 0);
  const worker = await handleAssistantWorkerRequest(
    { method: "GET", headers: { get: () => "" }, json: async () => { throw new Error("should not read"); } },
    {},
    new URL("http://localhost/api/assistant/items"),
  );
  assert.equal(worker.status, 404);
});

test("tokens are hashed, shown once, scoped to the user, and revocable", async () => {
  const repo = memoryRepo();
  const secret = await issueToken(repo, ["items:propose"]);
  assert.match(secret, /^cw_pat_/);
  const stored = repo.state.tokens[0];
  assert.notEqual(stored.tokenHash, secret);
  assert.equal(stored.tokenHash, await sha256Hex(secret));
  assert.equal(JSON.stringify(stored).includes(secret), false);
  const listed = await call(repo, {
    method: "GET",
    path: "/api/assistant/tokens",
    headers: { authorization: "Bearer firebase-user-a" },
  });
  assert.equal(listed.status, 200);
  assert.equal(JSON.stringify(listed.body).includes(secret), false);
  assert.equal(JSON.stringify(listed.body).includes(stored.tokenHash), false);
  assert.deepEqual(listed.body.tokens[0].scopes, ["items:read", "items:propose"]);
  const other = await call(repo, {
    method: "GET",
    path: "/api/assistant/tokens",
    headers: { authorization: "Bearer firebase-user-b" },
  });
  assert.deepEqual(other.body.tokens, []);
  const revoked = await call(repo, {
    method: "POST",
    path: `/api/assistant/tokens/${stored.id}/revoke`,
    headers: { authorization: "Bearer firebase-user-b" },
  });
  assert.equal(revoked.status, 404);
  const own = await call(repo, {
    method: "POST",
    path: `/api/assistant/tokens/${stored.id}/revoke`,
    headers: { authorization: "Bearer firebase-user-a" },
  });
  assert.equal(own.status, 200);
  const denied = await call(repo, {
    method: "GET",
    path: "/api/assistant/items",
    query: { workspaceId: "ws-a" },
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.equal(denied.status, 401);
  assert.equal(denied.body.code, "token_revoked");
});

test("a token cannot read another workspace or a workspace the user left", async () => {
  const repo = memoryRepo();
  const secret = await issueToken(repo, ["items:read"], ["ws-a"]);
  const cross = await call(repo, {
    method: "GET",
    path: "/api/assistant/items",
    query: { workspaceId: "ws-b" },
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.equal(cross.status, 403);
  assert.equal(cross.body.code, "cross_tenant_denied");
  assert.equal(JSON.stringify(cross.body).includes("Other tenant"), false);
  repo.state.members.delete("user-a:ws-a");
  const left = await call(repo, {
    method: "GET",
    path: "/api/assistant/items",
    query: { workspaceId: "ws-a" },
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.equal(left.status, 403);
  assert.equal(left.body.code, "forbidden");
  const unknown = await call(repo, {
    method: "GET",
    path: "/api/assistant/items",
    headers: { authorization: "Bearer cw_pat_not-a-real-token-value" },
  });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.code, "unauthenticated");
});

test("item reads are tenant-filtered, hierarchical, and incrementally pageable", async () => {
  const repo = memoryRepo();
  const secret = await issueToken(repo);
  const page = await call(repo, {
    method: "GET",
    path: "/api/assistant/items",
    query: { workspaceId: "ws-a", limit: "1" },
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.items.length, 1);
  assert.equal(page.body.items[0].id, "item-1");
  assert.equal(page.body.items[0].kind, "pbi");
  assert.equal(page.body.items[0].parent_id, "feature-1");
  assert.equal(page.body.items[0].epic_id, "epic-1");
  assert.equal(page.body.items[0].external_ref, "asana:1");
  assert.equal(page.body.items[0].attributes.delivery_entity, "Studio");
  assert.equal(page.body.items[0].attributes.client_entity, "Northwind");
  assert.deepEqual(page.body.items[0].tags, [{ id: "tag-1", name: "Product" }]);
  assert.equal(page.body.items.some((item: { id: string }) => item.id === "secret-other"), false);
  const next = await call(repo, {
    method: "GET",
    path: "/api/assistant/items",
    query: { workspaceId: "ws-a", limit: "1", cursor: page.body.next_cursor },
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.equal(next.body.items[0].id, "item-2");
  assert.equal(next.body.next_cursor, null);
  const since = await call(repo, {
    method: "GET",
    path: "/api/assistant/items",
    query: { workspaceId: "ws-a", updated_since: "2026-10-03T00:00:00.000Z" },
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.deepEqual(since.body.items.map((item: { id: string }) => item.id), ["item-2"]);
  const one = await call(repo, {
    method: "GET",
    path: "/api/assistant/items/item-1",
    query: { workspaceId: "ws-a" },
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.equal(one.body.item.title, "Old name");
  const missing = await call(repo, {
    method: "GET",
    path: "/api/assistant/items/secret-other",
    query: { workspaceId: "ws-a" },
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.equal(missing.status, 404);
  assert.ok(repo.state.audits.some((event) => event.action === "items.list" && event.tokenId));
});

test("proposals do not change items until the token owner approves them", async () => {
  const repo = memoryRepo();
  const readOnly = await issueToken(repo, ["items:read"]);
  const denied = await call(repo, {
    method: "POST",
    path: "/api/assistant/proposals",
    headers: { authorization: `Bearer ${readOnly}` },
    body: { workspaceId: "ws-a", action: "update", item_id: "item-1", fields: { title: "Hijack" } },
  });
  assert.equal(denied.status, 403);
  assert.equal(repo.state.items[0].title, "Old name");
  const secret = await issueToken(repo, ["items:propose"]);
  const queued = await call(repo, {
    method: "POST",
    path: "/api/assistant/proposals",
    headers: { authorization: `Bearer ${secret}` },
    body: {
      workspaceId: "ws-a",
      action: "update",
      item_id: "item-1",
      fields: { title: "Renamed by assistant", userId: "user-b", workspaceId: "ws-b" },
    },
  });
  assert.equal(queued.status, 202);
  assert.equal(repo.state.items[0].title, "Old name");
  assert.equal(repo.state.writes.includes("updateItem"), false);
  const stranger = await call(repo, {
    method: "POST",
    path: "/api/assistant/proposals/decide",
    headers: { authorization: "Bearer firebase-user-b" },
    body: { workspaceId: "ws-a", decisions: [{ id: queued.body.proposal.id, decision: "approve" }] },
  });
  assert.equal(stranger.status, 403);
  assert.equal(stranger.body.code, "forbidden");
  assert.equal(repo.state.items[0].title, "Old name");
  repo.state.members.add("user-b:ws-a");
  const coworker = await call(repo, {
    method: "POST",
    path: "/api/assistant/proposals/decide",
    headers: { authorization: "Bearer firebase-user-b" },
    body: { workspaceId: "ws-a", decisions: [{ id: queued.body.proposal.id, decision: "approve" }] },
  });
  assert.equal(coworker.body.results[0].code, "not_found");
  repo.state.members.delete("user-b:ws-a");
  assert.equal(repo.state.items[0].title, "Old name");
  const approved = await call(repo, {
    method: "POST",
    path: "/api/assistant/proposals/decide",
    headers: { authorization: "Bearer firebase-user-a" },
    body: { workspaceId: "ws-a", decisions: [{ id: queued.body.proposal.id, decision: "approve" }] },
  });
  assert.equal(approved.body.results[0].status, "approved");
  assert.equal(repo.state.items[0].title, "Renamed by assistant");
  assert.equal(repo.state.items[0].userId, "user-a");
  assert.equal(repo.state.items[0].workspaceId, "ws-a");
  assert.equal(repo.state.items[0].assistantAttribution.approvedByUserId, "user-a");
  const created = await call(repo, {
    method: "POST",
    path: "/api/assistant/proposals",
    headers: { authorization: `Bearer ${secret}` },
    body: { workspaceId: "ws-a", action: "create", fields: { title: "Follow up", kind: "pbi", external_ref: "ext-9" } },
  });
  assert.equal(repo.state.writes.includes("createItem"), false);
  await call(repo, {
    method: "POST",
    path: "/api/assistant/proposals/decide",
    headers: { authorization: "Bearer firebase-user-a" },
    body: {
      workspaceId: "ws-a",
      decisions: [
        { id: created.body.proposal.id, decision: "reject" },
      ],
    },
  });
  assert.equal(repo.state.items.some((item) => item.title === "Follow up"), false);
});

test("proposal creation is rate limited per token", async () => {
  const repo = memoryRepo();
  const secret = await issueToken(repo, ["items:propose"]);
  for (let index = 0; index < 30; index += 1) {
    const result = await call(repo, {
      method: "POST",
      path: "/api/assistant/proposals",
      headers: { authorization: `Bearer ${secret}` },
      body: { workspaceId: "ws-a", action: "reprioritize", item_id: "item-1", fields: { priority: index + 1 } },
    });
    assert.equal(result.status, 202, `proposal ${index}`);
  }
  const blocked = await call(repo, {
    method: "POST",
    path: "/api/assistant/proposals",
    headers: { authorization: `Bearer ${secret}` },
    body: { workspaceId: "ws-a", action: "close", item_id: "item-1" },
  });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, "rate_limited");
  assert.equal(repo.state.items[0].status, "open");
});

test("direct write requires items:write and stays inside the token workspace", async () => {
  const repo = memoryRepo();
  const secret = await issueToken(repo, ["items:read", "items:propose"]);
  const denied = await call(repo, {
    method: "POST",
    path: "/api/assistant/items",
    headers: { authorization: `Bearer ${secret}` },
    body: { workspaceId: "ws-a", title: "Direct" },
  });
  assert.equal(denied.status, 403);
  const writer = await issueToken(repo, ["items:write"]);
  const created = await call(repo, {
    method: "POST",
    path: "/api/assistant/items",
    headers: { authorization: `Bearer ${writer}` },
    body: { workspaceId: "ws-b", title: "Should not land" },
  });
  assert.equal(created.status, 403);
  const ok = await call(repo, {
    method: "POST",
    path: "/api/assistant/items",
    headers: { authorization: `Bearer ${writer}` },
    body: { workspaceId: "ws-a", title: "Direct", kind: "feature" },
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.item.workspace_id, "ws-a");
  assert.equal(ok.body.item.kind, "feature");
});

test("remote MCP propose_item queues work and list_items stays in tenant", async () => {
  const repo = memoryRepo();
  const secret = await issueToken(repo, ["items:propose"]);
  const listed = await call(repo, {
    method: "POST",
    path: "/api/assistant/mcp",
    headers: { authorization: `Bearer ${secret}` },
    body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_items", arguments: { workspace_id: "ws-a" } } },
  });
  assert.equal(listed.status, 200);
  const payload = listed.body.result.structuredContent;
  assert.equal(payload.items.some((item: { id: string }) => item.id === "secret-other"), false);
  const proposed = await call(repo, {
    method: "POST",
    path: "/api/assistant/mcp",
    headers: { authorization: `Bearer ${secret}` },
    body: {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "propose_item", arguments: { workspace_id: "ws-a", action: "close", item_id: "item-1" } },
    },
  });
  assert.equal(proposed.body.result.structuredContent.proposal.action, "close");
  assert.equal(repo.state.items[0].status, "open");
});

test("read model keeps stable ids and parent links", () => {
  const projected = projectWorkItem({
    id: "pbi-1",
    workspaceId: "ws-a",
    title: "Task",
    workItemType: "pbi",
    parentId: "feature-1",
    updatedAt: { seconds: 1_700_000_000 },
  });
  assert.equal(projected.id, "pbi-1");
  assert.equal(projected.parent_id, "feature-1");
  assert.match(projected.updated_at || "", /^2023-/);
  const page = listWorkItems(
    [
      { id: "b", workspaceId: "ws-a", updatedAt: "2026-01-02T00:00:00.000Z", title: "B" },
      { id: "a", workspaceId: "ws-a", updatedAt: "2026-01-01T00:00:00.000Z", title: "A" },
      { id: "c", workspaceId: "ws-z", updatedAt: "2026-01-03T00:00:00.000Z", title: "Hidden" },
    ],
    { workspaceId: "ws-a", limit: 10 },
  );
  assert.deepEqual(page.items.map((item) => item.id), ["a", "b"]);
});

test("tag catalog dedupes names and hides unresolved ids without deleting data", () => {
  const opaque = "rFCg1CMv6hv6t7XG2Wr7";
  assert.equal(isOpaqueCatalogId(opaque), true);
  const options = controlledOptions(
    [
      { id: opaque, name: "Product", group: "tag" },
      { id: "second-product", name: "Product", group: "tag" },
      { id: "urgent-id", name: "Urgent", group: "tag" },
    ],
    "tag",
    [opaque, "second-product", "Urgent", "Finance", "aaaaaaaaaaaaaaaaaaaa"],
  );
  assert.deepEqual(options.map((option) => option.name), ["Product", "Urgent", "Finance"]);
  const visible = categoriesVisibleInWorkspace(
    [
      { id: "1", name: "Here", workspaceId: "ws-a" },
      { id: "2", name: "Legacy" },
      { id: "3", name: "Elsewhere", workspaceId: "ws-b" },
    ],
    "ws-a",
  );
  assert.deepEqual(visible.map((row) => row.name), ["Here", "Legacy"]);
  const catalog = [
    { id: opaque, name: "Product" },
    { id: "second-product", name: "Product" },
  ];
  assert.deepEqual(dedupeTagsByName(catalog).map((tag) => tag.id), [opaque]);
  assert.deepEqual(tagLabels({ tagIds: ["second-product"] }, catalog), ["Product"]);
  assert.deepEqual(toggleTagWithCatalog({ tagIds: ["second-product"] }, opaque, catalog).tagIds, []);
});

test("opening an item uses the full pool when the filtered view dropped it", () => {
  const renamed = { id: "pbi-1", title: "Renamed" };
  assert.equal(findWorkItemById([[], [renamed]], "pbi-1")?.title, "Renamed");
  assert.equal(findWorkItemById([[{ id: "other" }]], "pbi-1"), null);
  let prevented = false;
  retainFocusForOpen({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
});

test("optimistic title and tag edits apply when updatedAt has not changed yet", () => {
  const store = createDocStore<{ id: string; updatedAt?: number; title?: string; tagIds?: string[] }>();
  store.replaceAll([{ id: "pbi-1", updatedAt: 5, title: "Before", tagIds: [] }]);
  let emits = 0;
  store.subscribe(() => { emits += 1; });
  applyStoreUpdate(store, (prev) =>
    prev.map((item) => (item.id === "pbi-1" ? { ...item, title: "After", tagIds: ["tag-1"] } : item)),
  );
  assert.equal(emits, 1);
  assert.equal(store.getSnapshot()[0].title, "After");
  assert.deepEqual(store.getSnapshot()[0].tagIds, ["tag-1"]);
  applyStoreUpdate(store, (prev) => prev);
  assert.equal(emits, 1);
  applyStoreUpdate(store, (prev) =>
    prev.map((item) => ({ ...item, tagIds: [...(item.tagIds || [])] })),
  );
  assert.equal(emits, 1);
});

test("tag loading and dialog open controls are wired without a rules change", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const items = readFileSync(resolve("src/components/WorkItemsCenter.tsx"), "utf8");
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  assert.match(workspace, /categoriesVisibleInWorkspace/);
  assert.match(workspace, /where\("userId", "==", user\.uid\)/);
  assert.doesNotMatch(workspace, /makeQueryLocal\("categories"/);
  assert.match(workspace, /getTasksSnapshot\(\)/);
  assert.match(workspace, /isAssistantAccessUiEnabled\(\)/);
  assert.match(items, /findWorkItemById\(\[tasks, hierarchyTasks\], selectedItemId\)/);
  assert.match(items, /retainFocusForOpen/);
  assert.doesNotMatch(rules, /assistant_access_tokens/);
  const flag = readFileSync(resolve("src/lib/assistantAccessFlag.ts"), "utf8");
  assert.match(flag, /VITE_ASSISTANT_ACCESS/);
  assert.match(flag, /raw === "1"/);
});
