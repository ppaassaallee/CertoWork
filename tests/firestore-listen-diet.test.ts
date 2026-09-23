import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLAB_PRESENCE_HEARTBEAT_MS,
  KANBAN_PRESENCE_HEARTBEAT_MS,
  NOTES_AUTOSAVE_DEBOUNCE_MS,
  resolveFirestoreListenPacks,
} from "../src/lib/firestoreListenDiet";

test("home and my-work keep tables/records but not odysseus or access requests", () => {
  const home = resolveFirestoreListenPacks({ kind: "home" });
  assert.equal(home.tables, true);
  assert.equal(home.tableRecords, true);
  assert.equal(home.odysseus, false);
  assert.equal(home.accessRequests, false);
  assert.equal(home.itemMessages, false);

  const myWork = resolveFirestoreListenPacks({ kind: "my-work", section: "assigned" });
  assert.equal(myWork.tableRecords, true);
  assert.equal(myWork.financeOps, false);
});

test("agents pack loads odysseus only", () => {
  const agents = resolveFirestoreListenPacks({ kind: "agents", section: "home" });
  assert.equal(agents.odysseus, true);
  assert.equal(agents.tableRecords, false);
  assert.equal(agents.itemMessages, false);
});

test("requests and collab load item messages without full table records", () => {
  const requests = resolveFirestoreListenPacks({ kind: "requests", section: "inbox" });
  assert.equal(requests.itemMessages, true);
  assert.equal(requests.tableRecords, false);

  const collab = resolveFirestoreListenPacks({ kind: "collab" });
  assert.equal(collab.itemMessages, true);
  assert.equal(collab.tables, false);
});

test("settings loads invites and access requests only when needed", () => {
  const settings = resolveFirestoreListenPacks({ kind: "settings" });
  assert.equal(settings.accessRequests, true);
  assert.equal(settings.invites, true);
  assert.equal(settings.tableRecords, false);
});

test("write cadences are slower than the previous always-on defaults", () => {
  assert.ok(COLLAB_PRESENCE_HEARTBEAT_MS >= 90_000);
  assert.ok(KANBAN_PRESENCE_HEARTBEAT_MS >= 45_000);
  assert.ok(NOTES_AUTOSAVE_DEBOUNCE_MS >= 2_000);
});
