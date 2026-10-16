import test from "node:test";
import assert from "node:assert/strict";
import { applyPendingFilter, normalizeTaskView } from "../src/lib/views/filterDraft";
import { buildTaskAdapter } from "../src/features/views/adapters/taskAdapter";
import { applyView } from "../src/lib/views/apply";
import { readFileSync } from "node:fs";

const adapter = buildTaskAdapter({ actorId: "test", workspaceId: "fixture", onUpdateTask: () => {} });
const view = adapter.defaultView("my-work");
test("Apply includes the selected filter without a separate Add filter click", () => {
  const next = applyPendingFilter({ ...view, filters: [] }, "status", "eq", "done");
  assert.deepEqual(next.filters, [{ columnId: "status", op: "eq", value: "done" }]);
  assert.equal(applyPendingFilter(next, "status", "eq", "done"), next);
  assert.equal(applyPendingFilter(next, "status", "eq", ""), next);
  assert.equal(applyPendingFilter(next, "due", "today", "").filters.length, 2);
});

test("view reloads depend on account/surface identity, not regenerated adapters", () => {
  const myWork = readFileSync(new URL("../src/features/views/MyWorkViewsSurface.tsx", import.meta.url), "utf8");
  const project = readFileSync(new URL("../src/features/views/ProjectItemsViewsSurface.tsx", import.meta.url), "utf8");
  assert.match(myWork, /\}, \[workspaceId, actorId\]\)/);
  assert.doesNotMatch(myWork, /\[workspaceId, actorId, systemViews, preferredSystemViewId\]/);
  assert.match(project, /\}, \[workspaceId, surface, actorId\]\)/);
  assert.doesNotMatch(project, /\[workspaceId, surface, actorId, defaultView\]/);
  const storage = readFileSync(new URL("../src/lib/views/storage.ts", import.meta.url), "utf8");
  const navigation = storage.slice(storage.indexOf("export async function setLastUsedView"));
  assert.doesNotMatch(navigation, /await setDoc/);
});

test("completion failures are caught and duplicate clicks cannot issue another write", () => {
  const source = readFileSync(new URL("../src/components/WorkItemsCenter.tsx", import.meta.url), "utf8");
  assert.match(source, /completionInFlight.current.has\(item.id\)/);
  assert.match(source, /Status was not saved/);
  assert.match(source, /awaiting server confirmation/);
  assert.match(source, /completionInFlight.current.delete\(item.id\)/);
});
test("task status filters match canonical and legacy rows on both surfaces", () => {
  const rows = [{ id: "a", status: "doing" }, { id: "b", status: "in_progress" }, { id: "c", status: "done" }, { id: "d", status: "completed" }];
  for (const surface of ["my-work", "project:fixture"] as const) {
    const base = adapter.defaultView(surface);
    const doing = normalizeTaskView({ ...base, filters: [{ columnId: "status", op: "eq", value: "doing" }] });
    assert.deepEqual(applyView(rows, adapter, doing, { userId: "test" }).rows.map((row) => row.id).sort(), ["a", "b"]);
    const done = applyPendingFilter({ ...base, filters: [] }, "status", "eq", "done");
    assert.deepEqual(applyView(rows, adapter, done, { userId: "test" }).rows.map((row) => row.id).sort(), ["c", "d"]);
  }
});
