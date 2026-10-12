import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareTaskCreatePayload, sanitizeFirestorePayload } from "../src/lib/firestorePayload";
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
} from "../src/lib/tagging";

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

test("a class instance such as a timestamp is not stripped", () => {
  class Stamp { constructor(public seconds: number) {} }
  const stamp = new Stamp(4);
  const payload = prepareTaskCreatePayload({ createdAt: stamp, acceptanceCriteria: "Done when reviewed" });
  assert.equal(payload.createdAt, stamp);
  assert.equal(payload.acceptanceCriteria, "Done when reviewed");
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
});
