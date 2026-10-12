import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { prepareItemWrite, prepareTaskCreatePayload, sanitizeFirestorePayload } from "../src/lib/firestorePayload";
import {
  consumeDeleteGesture,
  isRemovedWorkItem,
  removedItemMatchesStatus,
  resetDeleteGestureForTests,
  restoreItemPatch,
  softDeletePatch,
} from "../src/lib/itemRemoval";
import {
  canonicalTagIds,
  isTagCategory,
  normalizeTagKey,
  planTagCleanup,
  tagCleanupCsv,
  tagFilterOptions,
} from "../src/lib/tagging";
import { canManageWorkspaceMembers } from "../src/lib/workspaceCollaboration";
import { visibleWorkItems } from "../src/lib/itemRemoval";

test("task create drops undefined and stores acceptance criteria as a string", () => {
  const payload = prepareTaskCreatePayload({
    title: "Ship the brief",
    acceptanceCriteria: undefined,
    description: undefined,
    priority: null,
    nested: { note: undefined, keep: "yes" },
  });
  assert.equal(payload.acceptanceCriteria, "");
  assert.equal("description" in payload, false);
  assert.equal(payload.priority, null);
  assert.deepEqual(payload.nested, { keep: "yes" });
  assert.equal(sanitizeFirestorePayload({ acceptanceCriteria: undefined }).acceptanceCriteria, undefined);
});

test("every tasks create goes through the payload sanitizer", () => {
  const files = [
    "src/components/TaskDetails.tsx",
    "src/components/TasksList.tsx",
    "src/components/TimeBlocksPlanner.tsx",
    "src/components/NotebookPlanner.tsx",
    "src/components/StakeholdersList.tsx",
    "src/components/AIProjectBuilder.tsx",
    "src/components/ReviewCandidateCard.tsx",
    "src/components/ProjectMilestonesView.tsx",
    "src/components/BoldiFloatingWidget.tsx",
    "src/features/collab/ConversationThread.tsx",
    "src/components/DelivereeWorkspace.tsx",
    "src/components/Capture.tsx",
    "src/components/BoldiAssistant.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(resolve(file), "utf8");
    const creates = source.match(/addDoc\(collection\(db, "tasks"\)/g) || [];
    if (file.endsWith("Capture.tsx") || file.endsWith("BoldiAssistant.tsx")) {
      assert.match(source, /addDoc\(collection\(db, "inbox_items"\), sanitizeFirestorePayload\(/);
      continue;
    }
    assert.ok(creates.length > 0, file);
    assert.equal(source.split("prepareTaskCreatePayload(").length - 1 >= creates.length, true, file);
  }
});

test("item updates drop undefined and keep field values", () => {
  class FieldValue {
    labelText: string;
    constructor(labelText: string) {
      this.labelText = labelText;
    }
  }
  const stamp = new FieldValue("server");
  const payload = prepareItemWrite({
    title: "Keep",
    description: undefined,
    deletedAt: null,
    updatedAt: stamp,
  });
  assert.equal("description" in payload, false);
  assert.equal(payload.deletedAt, null);
  assert.equal(payload.updatedAt, stamp);
  assert.equal(payload.updatedAt.labelText, "server");
});

test("every tasks write goes through the payload sanitizer", () => {
  const files = walkSrc("src");
  const misses: string[] = [];
  for (const file of files) {
    const source = readFileSync(resolve(file), "utf8");
    for (const call of taskWritePayloads(source)) {
      if (!/prepareItemWrite\s*\(|prepareTaskCreatePayload\s*\(/.test(call.payload)) {
        misses.push(`${file}: ${call.preview}`);
      }
    }
  }
  assert.deepEqual(misses, []);
  const capture = readFileSync(resolve("src/features/capture/QuickCaptureModal.tsx"), "utf8");
  assert.equal(capture.includes("addDoc("), false);
});

function walkSrc(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name);
    if (statSync(path).isDirectory()) walkSrc(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

function taskWritePayloads(source: string) {
  const names = new Set<string>();
  const declared = /(?:const|let|var)\s+(\w+)\s*=\s*doc\(\s*db\s*,\s*["']tasks["']/g;
  let found: RegExpExecArray | null;
  while ((found = declared.exec(source))) names.add(found[1]);
  const calls: Array<{ payload: string; preview: string }> = [];
  const pattern = /(?:updateDoc|setDoc|\.update|\.set)\(/g;
  while ((found = pattern.exec(source))) {
    const open = found.index + found[0].length - 1;
    const close = matchingParen(source, open);
    if (close < 0) continue;
    const args = splitArgs(source.slice(open + 1, close));
    const first = (args[0] || "").trim();
    const ident = first.match(/^([A-Za-z_$][\w$]*)$/)?.[1] || "";
    const inline = /doc\(\s*db\s*,\s*["']tasks["']/.test(first);
    if ((!inline && !names.has(ident)) || args.length < 2) continue;
    calls.push({ payload: args[1], preview: source.slice(found.index, found.index + 80).replace(/\s+/g, " ") });
  }
  return calls;
}

function matchingParen(source: string, open: number) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' || char === "'" || char === "`") {
      i = skipString(source, i);
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitArgs(inner: string) {
  const args: string[] = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    if (char === '"' || char === "'" || char === "`") {
      i = skipString(inner, i);
      continue;
    }
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) {
      args.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  args.push(inner.slice(start));
  return args;
}

function skipString(source: string, index: number) {
  const quote = source[index];
  let i = index + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (quote === "`" && source[i] === "$" && source[i + 1] === "{") {
      i += 2;
      let depth = 1;
      while (i < source.length && depth) {
        if (source[i] === '"' || source[i] === "'" || source[i] === "`") i = skipString(source, i);
        else if (source[i] === "{") depth += 1;
        else if (source[i] === "}") depth -= 1;
        i += 1;
      }
      continue;
    }
    if (source[i] === quote) return i;
    i += 1;
  }
  return i;
}

test("a class instance such as a timestamp is not stripped", () => {
  class Stamp { constructor(public seconds: number) {} }
  const stamp = new Stamp(4);
  const payload = prepareTaskCreatePayload({ createdAt: stamp, acceptanceCriteria: "Done when reviewed" });
  assert.equal(payload.createdAt, stamp);
  assert.equal(payload.acceptanceCriteria, "Done when reviewed");
});

test("soft-deleted items stay out of live lists", () => {
  const live = { id: "live", status: "todo" };
  const deleted = { id: "gone", status: "deleted" };
  const stamped = { id: "stamped", status: "todo", deletedAt: "2026-10-01T00:00:00.000Z" };
  assert.deepEqual(visibleWorkItems([live, deleted, stamped]), [live]);
  assert.equal(isRemovedWorkItem({ status: "todo", archived: true }), true);
});

test("removed items stay out of Done and Backlog filters", () => {
  const deleted = { status: "deleted" };
  const archived = { status: "archived" };
  const done = { status: "done" };
  assert.equal(isRemovedWorkItem(deleted), true);
  assert.equal(removedItemMatchesStatus(deleted, "done"), false);
  assert.equal(removedItemMatchesStatus(deleted, "backlog"), false);
  assert.equal(removedItemMatchesStatus(deleted, "all"), false);
  assert.equal(removedItemMatchesStatus(deleted, "open"), false);
  assert.equal(removedItemMatchesStatus(deleted, "deleted"), true);
  assert.equal(removedItemMatchesStatus(archived, "done"), false);
  assert.equal(removedItemMatchesStatus(done, "done"), true);
});

test("soft delete is restorable and a double click is ignored", () => {
  const patch = softDeletePatch("in_progress", 1_700_000_000_000);
  assert.equal(patch.status, "deleted");
  assert.equal(patch.previousStatus, "in_progress");
  assert.equal(restoreItemPatch(patch.previousStatus).status, "in_progress");
  resetDeleteGestureForTests();
  assert.equal(consumeDeleteGesture(1000), true);
  assert.equal(consumeDeleteGesture(1200), false);
  assert.equal(consumeDeleteGesture(1600), true);
});

test("tags collapse case, accents, and repeated names, and entities are not tags", () => {
  assert.equal(normalizeTagKey("  Enviár  "), "enviar");
  assert.equal(isTagCategory({ id: "acme", group: "client_entity" }), false);
  assert.equal(isTagCategory({ id: "ops", group: "delivery_entity" }), false);
  const catalog = [
    { id: "enviar", name: "enviar", group: "tag" },
    { id: "enviar-2", name: "Enviar", group: "tag" },
    { id: "acme", name: "Acme", group: "client_entity" },
  ];
  assert.deepEqual(
    canonicalTagIds({ tagIds: ["enviar", "Enviar", "enviar-2", "enviár"] }, catalog),
    ["enviar"],
  );
  const once = planTagCleanup(
    [{ id: "item-1", tagIds: ["enviar", "enviar", "enviar", "enviar"] }],
    catalog,
  );
  assert.equal(once.length, 1);
  assert.deepEqual(once[0].after, ["enviar"]);
  assert.deepEqual(planTagCleanup([{ id: "item-1", tagIds: once[0].after }], catalog), []);
  const options = tagFilterOptions([
    { id: "enviar", name: "enviar", group: "tag" },
    { id: "enviar-2", name: "Enviar", group: "tag" },
    { id: "acme", name: "Acme", group: "client_entity" },
    { id: "ops", name: "Ops", group: "tag" },
  ]);
  assert.deepEqual(options.map((tag) => tag.id), ["enviar", "ops"]);
  assert.match(tagCleanupCsv(once), /item-1,enviar\|enviar\|enviar\|enviar,enviar/);
});

test("tag cleanup script stays dry-run and writes a review report", () => {
  const dir = mkdtempSync(join(tmpdir(), "certo-tags-"));
  const csv = join(dir, "plan.csv");
  const json = join(dir, "plan.json");
  const input = JSON.stringify([{ id: "item-1", tagIds: ["enviar", "Enviar"] }]);
  const catalog = join(dir, "catalog.json");
  writeFileSync(catalog, JSON.stringify([
    { id: "enviar", name: "enviar", group: "tag" },
    { id: "enviar-2", name: "Enviar", group: "tag" },
  ]));
  const ran = spawnSync("./node_modules/.bin/tsx", [
    "scripts/dedupe-item-tags.ts",
    "--catalog",
    catalog,
    "--out",
    json,
    "--csv",
    csv,
  ], { input, encoding: "utf8" });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /"dryRun": true/);
  assert.match(readFileSync(csv, "utf8"), /item-1/);
  assert.match(readFileSync(json, "utf8"), /"dryRun": true/);
  const refused = spawnSync("./node_modules/.bin/tsx", ["scripts/dedupe-item-tags.ts", "--apply"], {
    input: "[]",
    encoding: "utf8",
  });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /dry-run only/);
});

test("maintenance tools require a workspace owner or admin on the client and the server", () => {
  const shell = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const repair = shell.slice(shell.indexOf('data-testid="restore-creator-assignees"') - 400, shell.indexOf('data-testid="restore-creator-assignees"'));
  assert.equal(repair.includes("isDeveloperToolsEnabled"), false);
  assert.match(repair, /canManageMembers/);
  assert.match(shell, /assertWorkspaceAdmin/);
  assert.match(shell, /if \(!canManageMembers\)/);
  const gate = readFileSync(resolve("functions/src/tasks/assertWorkspaceAdmin.ts"), "utf8");
  assert.match(gate, /permission-denied/);
  assert.match(gate, /isWorkspaceOwnerOrAdmin/);
  assert.equal(canManageWorkspaceMembers("member", true), true);
  assert.equal(canManageWorkspaceMembers("admin", false), true);
  assert.equal(canManageWorkspaceMembers("member", false), false);
  const predicate = readFileSync(resolve("functions/src/tasks/workspaceAdmin.ts"), "utf8");
  assert.match(predicate, /role === "owner"/);
  assert.match(predicate, /role === "admin"/);
});
