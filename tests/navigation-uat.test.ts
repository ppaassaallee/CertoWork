import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkItemPaletteEntries,
  isRemovedWorkItem,
  paletteTaskMatches,
  readRecentItemIds,
  rememberRecentItem,
  type KeyValueStore,
  type PaletteTaskRow,
} from "../src/lib/commandSearch";
import { isDeveloperToolsEnabled } from "../src/lib/devTools";
import {
  chromeViewFromSearch,
  itemIdFromSearch,
  projectRouteState,
  searchWithItem,
  searchWithProjectView,
  shouldCloseItemOnProjectChange,
  staysOnProjectPath,
  tabForProjectView,
  workItemsModeForProjectView,
} from "../src/lib/projectViewUrl";
import { isFirestorePermissionDenied, logFirestoreListenError } from "../src/lib/workspaceLoadError";
import { shouldReloadWorkspace } from "../src/lib/workspaceSwitch";

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const sample: PaletteTaskRow = {
  id: "task-42",
  title: "Send report",
  key: "BW-12",
  projectId: "p1",
  projectName: "Boldr",
};

test("palette matches title, key, id, and project name", () => {
  assert.equal(paletteTaskMatches(sample, "send"), true);
  assert.equal(paletteTaskMatches(sample, "BW-12"), true);
  assert.equal(paletteTaskMatches(sample, "task-42"), true);
  assert.equal(paletteTaskMatches(sample, "boldr"), true);
  assert.equal(paletteTaskMatches(sample, "missing"), false);
  assert.equal(isRemovedWorkItem({ status: "deleted" }), true);
  assert.equal(isRemovedWorkItem({ status: "done" }), false);
  assert.equal(isRemovedWorkItem({ archived: true, status: "todo" }), true);
});

test("palette lists recent items first and skips them in the catalog", () => {
  const entries = buildWorkItemPaletteEntries({
    tasks: [sample, { ...sample, id: "task-9", title: "Other", key: "BW-9" }],
    recentIds: ["task-42"],
  });
  assert.equal(entries[0]?.group, "Recent");
  assert.equal(entries[0]?.taskId, "task-42");
  assert.equal(entries.some((entry) => entry.id === "item-task-42"), false);
  assert.equal(entries.some((entry) => entry.id === "item-task-9"), true);
});

test("recent item ids stay unique and capped", () => {
  const store = memoryStore();
  assert.deepEqual(rememberRecentItem("a", store), ["a"]);
  assert.deepEqual(rememberRecentItem("b", store), ["b", "a"]);
  assert.deepEqual(rememberRecentItem("a", store), ["a", "b"]);
  for (let index = 0; index < 10; index += 1) rememberRecentItem(`id-${index}`, store);
  const ids = readRecentItemIds(store);
  assert.equal(ids.length, 8);
  assert.equal(ids[0], "id-9");
});

test("project view tokens round-trip and keep the item query", () => {
  assert.equal(chromeViewFromSearch("?view=board"), "kanban");
  assert.equal(chromeViewFromSearch("?view=table"), "list");
  assert.equal(chromeViewFromSearch("?view=economics"), null);
  const next = searchWithProjectView("?item=abc", "kanban");
  const params = new URLSearchParams(next.slice(1));
  assert.equal(params.get("view"), "board");
  assert.equal(params.get("item"), "abc");
  assert.equal(tabForProjectView("docs"), "docs");
  assert.equal(tabForProjectView("kanban"), "items");
  assert.equal(workItemsModeForProjectView("gantt"), "gantt");
  assert.equal(workItemsModeForProjectView("docs"), null);
});

test("item query helpers read and write without dropping the view", () => {
  assert.equal(itemIdFromSearch("?item=abc&view=board"), "abc");
  assert.equal(itemIdFromSearch(""), null);
  const next = searchWithItem("?view=board", "abc");
  const params = new URLSearchParams(next.slice(1));
  assert.equal(params.get("item"), "abc");
  assert.equal(params.get("view"), "board");
  const cleared = new URLSearchParams(searchWithItem("?item=abc&view=board", null).slice(1));
  assert.equal(cleared.get("item"), null);
  assert.equal(cleared.get("view"), "board");
});

test("opening or closing an item stays on the same project path", () => {
  assert.equal(staysOnProjectPath("/work/projects/abc", "abc"), true);
  assert.equal(staysOnProjectPath("/work/projects/abc/tasks", "abc"), true);
  assert.equal(staysOnProjectPath("/work/projects/abc/", "abc"), true);
  assert.equal(staysOnProjectPath("/projects", "abc"), false);
  assert.equal(staysOnProjectPath("/work/projects/other", "abc"), false);
  assert.equal(shouldCloseItemOnProjectChange("", "abc"), false);
  assert.equal(shouldCloseItemOnProjectChange("abc", "abc"), false);
  assert.equal(shouldCloseItemOnProjectChange("abc", "def"), true);
});

test("project route stays quiet until the project list has hydrated", () => {
  assert.equal(projectRouteState(0, false), "loading");
  assert.equal(projectRouteState(4, false), "missing");
  assert.equal(projectRouteState(4, true), "ready");
});

test("permission-denied listens stay out of the error log", () => {
  assert.equal(isFirestorePermissionDenied({ code: "permission-denied" }), true);
  assert.equal(isFirestorePermissionDenied({ code: "firestore/permission-denied" }), true);
  assert.equal(isFirestorePermissionDenied({ message: "Missing or insufficient permissions." }), true);
  assert.equal(isFirestorePermissionDenied({ code: "unavailable" }), false);
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  try {
    logFirestoreListenError("tasks", { code: "permission-denied" });
    assert.equal(errors.length, 0);
    logFirestoreListenError("tasks", { code: "unavailable" });
    assert.equal(errors.length, 1);
  } finally {
    console.error = original;
  }
});

test("developer tools and workspace reload are explicit", () => {
  const store = memoryStore();
  assert.equal(isDeveloperToolsEnabled(store), false);
  store.setItem("certo-dev-tools", "1");
  assert.equal(isDeveloperToolsEnabled(store), true);
  assert.equal(shouldReloadWorkspace(undefined), false);
  assert.equal(shouldReloadWorkspace({ reload: false }), false);
  assert.equal(shouldReloadWorkspace({ reload: true }), true);
});
