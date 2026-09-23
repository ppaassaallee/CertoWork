import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

test("requests load only selected item messages; collab uses its own thread listener", () => {
  const requests = resolveFirestoreListenPacks({ kind: "requests", section: "inbox" });
  assert.equal(requests.itemMessages, true);
  assert.equal(requests.tableRecords, false);

  const collab = resolveFirestoreListenPacks({ kind: "collab" });
  assert.equal(collab.itemMessages, false);
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

test("route changes do not restart core listeners or read every ticket message", () => {
  const shell = readFileSync(resolve(import.meta.dirname, "../src/components/DelivereeWorkspace.tsx"), "utf8");
  assert.match(shell, /The core shell stays subscribed across route changes\.[\s\S]*?\[dataAccessKey, dataRetryVersion, reportDataSyncError\]/);
  assert.doesNotMatch(shell, /subscribeWorkspaceItemMessages/);
  assert.match(shell, /subscribeItemMessages\(selectedRequestId/);
});

test("longer note debounce flushes a pending edit on navigation", () => {
  const notes = readFileSync(resolve(import.meta.dirname, "../src/components/NotesWorkspace.tsx"), "utf8");
  assert.match(notes, /useEffect\(\(\) => \(\) => \{ void flushPendingSave\(\); \}, \[selectedNote\?\.id, flushPendingSave\]\)/);
});
