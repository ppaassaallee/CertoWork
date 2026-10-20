import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatStatusActivity } from "../src/lib/activityText";
import {
  SOFT_DELETE_MS,
  authenticateMcp,
  createMemoryMcpRepo,
  executeTool,
  handleMcpHttp,
  issueToken,
  revokeToken,
} from "../worker/mcp/remoteCore.js";

const NOW = Date.parse("2026-10-16T12:00:00.000Z");

function seed() {
  const repo = createMemoryMcpRepo();
  repo.state.workspaces.push(
    { id: "w1", name: "One", ownerId: "user-1" },
    { id: "w2", name: "Two", ownerId: "user-1" },
    { id: "foreign", name: "Foreign", ownerId: "other" },
  );
  repo.state.members.push({
    workspaceId: "w1",
    userId: "member-2",
    status: "active",
    displayName: "Ada",
    email: "ada@example.com",
  });
  for (const workspaceId of ["w1", "w2"]) {
    repo.state.categories.push(
      { id: `${workspaceId}-client`, workspaceId, group: "client_entity", name: "Acme" },
      { id: `${workspaceId}-delivery`, workspaceId, group: "delivery_entity", name: "Studio" },
      { id: `${workspaceId}-tag`, workspaceId, group: "tag", name: "Billing" },
    );
  }
  return repo;
}

async function tokenFor(
  repo: ReturnType<typeof seed>,
  permission: "read" | "read-write",
  workspaceIds = ["w1"],
  assign = false,
) {
  const issued = await issueToken(
    repo,
    { uid: "user-1" },
    { name: "Laptop", workspaceIds, permission, assign, expiresInDays: 30 },
    NOW,
  );
  return issued;
}

async function call(
  repo: ReturnType<typeof seed>,
  secret: string,
  name: string,
  args: Record<string, unknown>,
  accept = "application/json",
) {
  const response = await handleMcpHttp({
    repo,
    method: "POST",
    authorization: `Bearer ${secret}`,
    accept,
    body: {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name, arguments: args },
    },
    now: NOW,
  });
  const payload = JSON.parse(response.body);
  if (!payload.result) return { response, payload, isError: true, data: payload.error?.data || payload };
  const data = JSON.parse(payload.result.content[0].text);
  return { response, payload, isError: payload.result.isError === true, data };
}

test("a token stores only the hash and lists its own workspaces", async () => {
  const repo = seed();
  const issued = await tokenFor(repo, "read", ["w1", "w2"]);
  const stored = repo.state.tokens[0];
  assert.equal(stored.tokenHash.length, 64);
  assert.equal(JSON.stringify(stored).includes(issued.token), false);
  assert.equal(issued.tokenHash, undefined);
  repo.state.workspaces.find((workspace: { id: string; ownerId: string }) => workspace.id === "w2").ownerId = "other";
  const listed = await executeTool(repo, stored, "list_workspaces", {}, NOW);
  assert.deepEqual(listed.workspaces.map((workspace: { id: string }) => workspace.id), ["w1"]);
  const foreign = await call(repo, issued.token, "list_items", { workspace_id: "foreign" });
  assert.equal(foreign.isError, true);
  assert.equal(foreign.data.code, "workspace_forbidden");
  assert.equal(JSON.stringify(foreign.data).includes("secret-item"), false);
});

test("a read-only token cannot write, and a foreign item stays hidden", async () => {
  const repo = seed();
  repo.state.items.push({
    id: "secret-item",
    workspaceId: "foreign",
    title: "Do not leak",
    workItemType: "pbi",
    status: "backlog",
    userId: "other",
  });
  const issued = await tokenFor(repo, "read");
  const denied = await call(repo, issued.token, "get_item", { workspace_id: "w1", item_id: "secret-item" });
  assert.equal(denied.data.code, "not_found");
  const write = await call(repo, issued.token, "create_item", {
    workspace_id: "w1",
    type: "epic",
    title: "Nope",
  });
  assert.equal(write.isError, true);
  assert.equal(write.data.code, "read_only");
  assert.equal(repo.state.items.length, 1);
});

test("hierarchy, catalog, and parent rules reject an invalid type or parent", async () => {
  const repo = seed();
  const issued = await tokenFor(repo, "read-write");
  const stored = repo.state.tokens[0];
  const epic = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "epic",
    title: "Roadmap",
  }, NOW);
  const feature = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "feature",
    title: "Billing",
    parent_id: epic.item.id,
  }, NOW);
  const badPbi = await call(repo, issued.token, "create_item", {
    workspace_id: "w1",
    type: "pbi",
    title: "Loose parent",
    parent_id: epic.item.id,
  });
  assert.equal(badPbi.data.code, "invalid_parent");
  const pbi = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "pbi",
    title: "Invoice",
    parent_id: feature.item.id,
    client: "Acme",
    delivery: "Studio",
    tags: ["Billing"],
    external_id: "crm-1",
  }, NOW);
  assert.equal(pbi.item.parent_id, feature.item.id);
  assert.equal(pbi.item.client, "Acme");
  const again = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "pbi",
    title: "Duplicate",
    external_id: "crm-1",
  }, NOW);
  assert.equal(again.created, false);
  assert.equal(again.item.id, pbi.item.id);
  const badTag = await call(repo, issued.token, "create_item", {
    workspace_id: "w1",
    type: "epic",
    title: "New tag",
    tags: ["Not a real tag"],
  });
  assert.equal(badTag.data.code, "unknown_tag");
  const sub = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "subtask",
    title: "Send",
    parent_id: pbi.item.id,
  }, NOW);
  const badSub = await call(repo, issued.token, "set_parent", {
    workspace_id: "w1",
    item_id: sub.item.id,
    parent_id: feature.item.id,
  });
  assert.equal(badSub.data.code, "invalid_parent");
  const tree = await executeTool(repo, stored, "get_hierarchy", { workspace_id: "w1" }, NOW);
  assert.equal(tree.tree[0].children[0].children[0].title, "Invoice");
  const fields = await executeTool(repo, stored, "list_fields", { workspace_id: "w1" }, NOW);
  assert.ok(fields.clients.some((client: { name: string }) => client.name === "Acme"));
  assert.ok(fields.members.some((member: { name: string }) => member.name === "Ada"));
});

test("assign stays off unless the token allows it, and writes land in history", async () => {
  const repo = seed();
  const plain = await tokenFor(repo, "read-write");
  const blocked = await call(repo, plain.token, "create_item", {
    workspace_id: "w1",
    type: "epic",
    title: "Owned",
    assignee: "Ada",
  });
  assert.equal(blocked.data.code, "assign_forbidden");
  const writer = await issueToken(
    repo,
    { uid: "user-1" },
    { name: "Writer", workspaceIds: ["w1"], permission: "read-write", assign: true, expiresInDays: 9 },
    NOW,
  );
  const writerToken = repo.state.tokens.find((row: { name: string }) => row.name === "Writer");
  const created = await executeTool(repo, writerToken, "create_item", {
    workspace_id: "w1",
    type: "epic",
    title: "Owned",
    assignee: "Ada",
  }, NOW);
  assert.equal(created.item.assignee.id, "member-2");
  const item = repo.state.items.find((row: { id: string }) => row.id === created.item.id);
  const entry = item.statusHistory.at(-1);
  assert.equal(entry.by, "vía API (Writer)");
  assert.equal(entry.via, "api");
  assert.equal(formatStatusActivity(entry), entry.text);
  assert.equal(repo.state.audits.some((audit: { tokenId: string }) => audit.tokenId === writer.id), true);
  assert.equal(JSON.stringify(repo.state.audits).includes(writer.token), false);
});

test("bulk dry-run does not write, delete is soft for 30 days, and move keeps descendants", async () => {
  const repo = seed();
  const issued = await tokenFor(repo, "read-write", ["w1", "w2"]);
  const stored = repo.state.tokens[0];
  const epic = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "epic",
    title: "Move me",
    client: "Acme",
  }, NOW);
  const feature = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "feature",
    title: "Child",
    parent_id: epic.item.id,
    client: "Acme",
  }, NOW);
  const preview = await executeTool(repo, stored, "bulk_update", {
    workspace_id: "w1",
    dry_run: true,
    items: [{ item_id: epic.item.id, title: "Renamed" }, { item_id: "missing", title: "No" }],
  }, NOW);
  assert.equal(preview.applied, false);
  assert.equal(repo.state.items.find((row: { id: string }) => row.id === epic.item.id).title, "Move me");
  const applied = await executeTool(repo, stored, "bulk_update", {
    workspace_id: "w1",
    dry_run: false,
    items: [{ item_id: epic.item.id, title: "Renamed" }],
  }, NOW);
  assert.equal(applied.applied, true);
  assert.equal(repo.state.items.find((row: { id: string }) => row.id === epic.item.id).title, "Renamed");
  const blocked = await executeTool(repo, stored, "delete_item", {
    workspace_id: "w1",
    item_id: epic.item.id,
  }, NOW).catch((error: { code?: string }) => error);
  assert.equal(blocked.code, "has_children");
  const removed = await executeTool(repo, stored, "delete_item", {
    workspace_id: "w1",
    item_id: feature.item.id,
  }, NOW);
  assert.equal(removed.deleted, true);
  assert.equal(Date.parse(removed.recoverable_until) - NOW, SOFT_DELETE_MS);
  assert.equal(repo.state.items.find((row: { id: string }) => row.id === feature.item.id).status, "deleted");
  const leaf = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "feature",
    title: "Keep history",
    parent_id: epic.item.id,
  }, NOW);
  await executeTool(repo, stored, "add_comment", {
    workspace_id: "w1",
    item_id: leaf.item.id,
    text: "note",
  }, NOW);
  const beforeHistory = repo.state.items.find((row: { id: string }) => row.id === leaf.item.id).statusHistory.length;
  const moved = await executeTool(repo, stored, "move_item_to_workspace", {
    workspace_id: "w1",
    item_id: epic.item.id,
    target_workspace_id: "w2",
  }, NOW);
  assert.ok(moved.moved.includes(epic.item.id));
  assert.ok(moved.moved.includes(leaf.item.id));
  const movedLeaf = repo.state.items.find((row: { id: string }) => row.id === leaf.item.id);
  assert.equal(movedLeaf.workspaceId, "w2");
  assert.equal(movedLeaf.comments[0].author, "vía API (Laptop)");
  assert.ok(movedLeaf.statusHistory.length > beforeHistory);
  const other = await call(repo, issued.token, "move_item_to_workspace", {
    workspace_id: "w2",
    item_id: epic.item.id,
    target_workspace_id: "foreign",
  });
  assert.equal(other.data.code, "workspace_forbidden");
});

test("expired, revoked, and over-limit tokens stop before any read", async () => {
  const repo = seed();
  const issued = await tokenFor(repo, "read");
  repo.state.tokens[0].expiresAt = new Date(NOW - 1000).toISOString();
  const expired = await handleMcpHttp({
    repo,
    method: "POST",
    authorization: `Bearer ${issued.token}`,
    accept: "application/json",
    body: { jsonrpc: "2.0", id: 1, method: "ping" },
    now: NOW,
  });
  assert.equal(expired.status, 401);
  assert.equal(JSON.parse(expired.body).error.data.code, "token_expired");
  repo.state.tokens[0].expiresAt = new Date(NOW + 86_400_000).toISOString();
  await revokeToken(repo, { uid: "user-1" }, issued.id, NOW);
  const revoked = await handleMcpHttp({
    repo,
    method: "POST",
    authorization: `Bearer ${issued.token}`,
    accept: "application/json",
    body: { jsonrpc: "2.0", id: 1, method: "ping" },
    now: NOW,
  });
  assert.equal(JSON.parse(revoked.body).error.data.code, "token_revoked");

  const fresh = await tokenFor(repo, "read");
  for (let i = 0; i < 60; i += 1) {
    await authenticateMcp(repo, `Bearer ${fresh.token}`, NOW);
  }
  await assert.rejects(
    () => authenticateMcp(repo, `Bearer ${fresh.token}`, NOW),
    (error: { code?: string }) => error.code === "rate_limited",
  );
});

test("streamable HTTP speaks initialize and SSE without taking the Codex route", async () => {
  const repo = seed();
  const issued = await tokenFor(repo, "read");
  const opened = await handleMcpHttp({
    repo,
    method: "POST",
    authorization: `Bearer ${issued.token}`,
    accept: "application/json, text/event-stream",
    body: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    },
    now: NOW,
  });
  assert.equal(opened.status, 200);
  assert.match(opened.body, /^event: message\ndata: /);
  assert.match(opened.body, /Certo Work/);
  const listed = await handleMcpHttp({
    repo,
    method: "POST",
    authorization: `Bearer ${issued.token}`,
    accept: "application/json",
    body: { jsonrpc: "2.0", id: 2, method: "tools/list" },
    now: NOW + 61_000,
  });
  const tools = JSON.parse(listed.body).result.tools.map((tool: { name: string }) => tool.name);
  assert.ok(tools.includes("list_workspaces"));
  assert.ok(tools.includes("delete_item"));
  const worker = readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");
  const integrations = readFileSync(new URL("../src/components/Settings/Integrations.tsx", import.meta.url), "utf8");
  assert.match(worker, /handleWorkerMcp/);
  assert.match(integrations, /ApiTokensPanel/);
  assert.match(worker, /\/mcp\/delivereeos/);
  const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
  assert.match(server, /req.path === "\/mcp\/tokens"/);
  const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(wrangler, /"\/mcp"/);
  assert.match(wrangler, /"\/mcp\/\*"/);
});

test("search stays inside the workspace and compact fields keep the workspace", async () => {
  const repo = seed();
  const issued = await tokenFor(repo, "read", ["w1", "w2"]);
  const stored = repo.state.tokens[0];
  repo.state.items.push(
    { id: "needle-w1", workspaceId: "w1", title: "Shared needle", description: "only one", workItemType: "epic", status: "todo", userId: "user-1", dueDate: "2026-10-01" },
    { id: "needle-w2", workspaceId: "w2", title: "Shared needle", workItemType: "epic", status: "todo", userId: "user-1" },
    { id: "done-w1", workspaceId: "w1", title: "Finished needle", workItemType: "epic", status: "done", userId: "user-1" },
    { id: "later-w1", workspaceId: "w1", title: "Later", workItemType: "pbi", status: "todo", userId: "user-1", dueDate: "2026-12-01", assigneeId: "" },
  );
  const found = await executeTool(repo, stored, "search", { workspace_id: "w1", query: "Shared needle" }, NOW);
  assert.deepEqual(found.items.map((item: { id: string }) => item.id), ["needle-w1"]);
  assert.equal(found.workspace_id, "w1");
  assert.equal(found.workspace_name, "One");
  assert.equal(JSON.stringify(found).includes("needle-w2"), false);
  const compact = await executeTool(repo, stored, "get_item", {
    workspace_id: "w1",
    item_id: "needle-w1",
    fields: ["title", "due_date"],
  }, NOW);
  assert.equal(compact.item.workspace_id, "w1");
  assert.equal(compact.item.workspace_name, "One");
  assert.equal(compact.item.title, "Shared needle");
  assert.equal(compact.item.due_date, "2026-10-01T00:00:00.000Z");
  assert.equal(compact.item.description, undefined);
  const listed = await executeTool(repo, stored, "list_items", { workspace_id: "w1" }, NOW);
  assert.equal(listed.items.some((item: { id: string }) => item.id === "done-w1"), false);
  assert.equal(listed.items.some((item: { id: string }) => item.id === "later-w1"), true);
  const withDone = await executeTool(repo, stored, "list_items", { workspace_id: "w1", incluir_completados: true }, NOW);
  assert.equal(withDone.items.some((item: { id: string }) => item.id === "done-w1"), true);
  const overdue = await executeTool(repo, stored, "list_items", { workspace_id: "w1", vencidos: true }, NOW);
  assert.deepEqual(overdue.items.map((item: { id: string }) => item.id), ["needle-w1"]);
  const foreign = await call(repo, issued.token, "search", { workspace_id: "foreign", query: "Shared needle" });
  assert.equal(foreign.data.code, "workspace_forbidden");
});

test("exact PBI and task stay distinct, and a read-only or no-delete token cannot change them", async () => {
  const repo = seed();
  repo.state.projects.push({ id: "proj-1", workspaceId: "w1", name: "Billing App", status: "active" });
  const issued = await tokenFor(repo, "read-write", ["w1", "w2"]);
  const stored = repo.state.tokens[0];
  const feature = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "feature",
    title: "Parent",
  }, NOW);
  const pbi = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "pbi",
    title: "Story slice",
    description: "keep me",
    parent_id: feature.item.id,
    project_id: "proj-1",
    product_phase: "Build",
  }, NOW);
  const task = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "task",
    title: "Task slice",
    parent_id: feature.item.id,
  }, NOW);
  assert.equal(pbi.item.type, "pbi");
  assert.equal(task.item.type, "task");
  assert.equal(pbi.item.type_label, "PBI/Task");
  assert.equal(task.item.type_label, "PBI/Task");
  assert.notEqual(pbi.item.type, task.item.type);
  assert.equal(pbi.item.project_id, "proj-1");
  assert.equal(pbi.item.product_phase, "Build");
  const full = await executeTool(repo, stored, "get_item", { workspace_id: "w1", item_id: pbi.item.id }, NOW);
  assert.deepEqual(full.item.chain.map((row: { type: string }) => row.type), ["feature", "pbi"]);
  const changed = await executeTool(repo, stored, "change_type", {
    workspace_id: "w1",
    item_id: pbi.item.id,
    type: "task",
  }, NOW);
  assert.equal(changed.item.type, "task");
  assert.equal(changed.item.description, "keep me");
  assert.equal(changed.item.project_id, "proj-1");
  const badParent = await call(repo, issued.token, "create_item", {
    workspace_id: "w1",
    type: "bug",
    title: "Loose bug",
    parent_id: feature.item.id,
  });
  assert.equal(badParent.data.code, "invalid_parent");
  const line = await executeTool(repo, stored, "add_checklist_line", {
    workspace_id: "w1",
    item_id: task.item.id,
    text: "Check the invoice",
  }, NOW);
  const sub = await executeTool(repo, stored, "add_subtask", {
    workspace_id: "w1",
    parent_id: task.item.id,
    title: "Send the invoice",
  }, NOW);
  assert.notEqual(line.line.id, sub.item.id);
  assert.equal(sub.item.type, "subtask");
  assert.equal(repo.state.items.filter((row: { parentId?: string }) => row.parentId === task.item.id).length, 1);
  const detail = await executeTool(repo, stored, "get_item", { workspace_id: "w1", item_id: task.item.id }, NOW);
  assert.equal(detail.item.checklist.length, 1);
  assert.equal(detail.item.subtasks.length, 1);
  const locked = await issueToken(
    repo,
    { uid: "user-1" },
    { name: "No delete", workspaceIds: ["w1"], permission: "read-write", canDelete: false, admin: false, expiresInDays: 30 },
    NOW,
  );
  const lockedToken = repo.state.tokens.find((row: { id: string }) => row.id === locked.id);
  const deniedDelete = await executeTool(repo, lockedToken, "delete_item", {
    workspace_id: "w1",
    item_id: sub.item.id,
  }, NOW).catch((error: { code?: string }) => error);
  assert.equal(deniedDelete.code, "delete_forbidden");
  assert.notEqual(repo.state.items.find((row: { id: string }) => row.id === sub.item.id).status, "deleted");
  const deniedTag = await call(repo, locked.token, "create_tag", { workspace_id: "w1", name: "Ops" });
  assert.equal(deniedTag.data.code, "admin_required");
  const badTag = await call(repo, issued.token, "create_item", {
    workspace_id: "w1",
    type: "epic",
    title: "Bad tag",
    tags: ["Not a real tag"],
  });
  assert.equal(badTag.data.code, "unknown_tag");
  assert.match(badTag.data.message, /Billing/);
  const admin = await issueToken(
    repo,
    { uid: "user-1" },
    { name: "Admin", workspaceIds: ["w1"], permission: "read-write", admin: true, expiresInDays: 30 },
    NOW,
  );
  const adminToken = repo.state.tokens.find((row: { id: string }) => row.id === admin.id);
  const createdTag = await executeTool(repo, adminToken, "create_tag", { workspace_id: "w1", name: "Ops" }, NOW);
  assert.equal(createdTag.created, true);
  const again = await executeTool(repo, adminToken, "create_tag", { workspace_id: "w1", name: "Ops" }, NOW);
  assert.equal(again.created, false);
});

test("cascade delete restores, dry-run move writes nothing, and a move can retarget the parent", async () => {
  const repo = seed();
  const issued = await tokenFor(repo, "read-write", ["w1", "w2"]);
  const stored = repo.state.tokens[0];
  const epic = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "epic",
    title: "Tree",
  }, NOW);
  const feature = await executeTool(repo, stored, "create_item", {
    workspace_id: "w1",
    type: "feature",
    title: "Branch",
    parent_id: epic.item.id,
  }, NOW);
  const home = await executeTool(repo, stored, "create_item", {
    workspace_id: "w2",
    type: "epic",
    title: "Home",
  }, NOW);
  const preview = await executeTool(repo, stored, "bulk_move_to_workspace", {
    workspace_id: "w1",
    target_workspace_id: "w2",
    item_ids: [feature.item.id],
    dry_run: true,
  }, NOW);
  assert.equal(preview.applied, false);
  assert.equal(repo.state.items.find((row: { id: string }) => row.id === feature.item.id).workspaceId, "w1");
  const tooBig = await executeTool(repo, stored, "bulk_update", {
    workspace_id: "w1",
    items: Array.from({ length: 201 }, (_, index) => ({ item_id: `missing-${index}`, title: "x" })),
  }, NOW).catch((error: { code?: string }) => error);
  assert.equal(tooBig.code, "bulk_too_large");
  const moved = await executeTool(repo, stored, "move_item_to_workspace", {
    workspace_id: "w1",
    item_id: feature.item.id,
    target_workspace_id: "w2",
    target_parent_id: home.item.id,
  }, NOW);
  assert.equal(moved.item.parent_id, home.item.id);
  assert.equal(moved.item.workspace_id, "w2");
  assert.ok(moved.moved.includes(feature.item.id));
  const copy = await executeTool(repo, stored, "duplicate_item", {
    workspace_id: "w2",
    item_id: feature.item.id,
  }, NOW);
  assert.notEqual(copy.item.id, feature.item.id);
  assert.equal(copy.item.external_id, null);
  assert.equal(repo.state.items.filter((row: { parentId?: string }) => row.parentId === feature.item.id).length, 0);
  const removed = await executeTool(repo, stored, "delete_item", {
    workspace_id: "w1",
    item_id: epic.item.id,
    cascade: true,
  }, NOW);
  assert.equal(removed.deleted, true);
  assert.equal(repo.state.items.find((row: { id: string }) => row.id === epic.item.id).status, "deleted");
  const restored = await executeTool(repo, stored, "restore_item", {
    workspace_id: "w1",
    item_id: epic.item.id,
  }, NOW);
  assert.equal(restored.restored, true);
  assert.equal(restored.item.status, "backlog");
  const view = await executeTool(repo, stored, "create_view", {
    workspace_id: "w1",
    preset: "vencidos",
  }, NOW);
  assert.equal(view.view.name, "Vencidos");
  assert.equal(view.view.workspace_id, "w1");
  const views = await executeTool(repo, stored, "list_views", { workspace_id: "w1" }, NOW);
  assert.equal(views.views.some((row: { name: string }) => row.name === "Vencidos"), true);
  assert.equal(views.workspace_name, "One");
  const project = await executeTool(repo, stored, "get_project", { workspace_id: "w2", project_id: "missing" }, NOW).catch((error: { code?: string }) => error);
  assert.equal(project.code, "not_found");
  void issued;
});
