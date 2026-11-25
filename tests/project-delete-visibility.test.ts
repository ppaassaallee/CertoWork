import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  matchesPortfolioLifecycle,
  preferRecentProjectSnapshot,
  projectLifecycleStatus,
  viewRequestsDeletedProjects,
} from "../src/lib/projectVisibility";
import { createCompleteSnapshotMerge } from "../src/lib/firestoreSnapshotSafety";
import { buildProjectAdapter } from "../src/features/views/adapters/projectAdapter";
import { applyView } from "../src/lib/views/apply";

test("deleted projects stay hidden after Clear all and default open filters", () => {
  for (const filter of ["all", "active"]) {
    assert.equal(matchesPortfolioLifecycle({ status: "deleted" }, filter, []), false);
    assert.equal(matchesPortfolioLifecycle({ status: " Deleted " }, filter, []), false);
    assert.equal(matchesPortfolioLifecycle({ status: "active", deletedAt: new Date() }, filter, []), false);
    assert.equal(matchesPortfolioLifecycle({ status: "planning" }, filter, []), true);
  }
});
test("trash remains accessible explicitly; clearing filters hides it again", () => {
  const deleted = { status: "deleted" };
  assert.equal(matchesPortfolioLifecycle(deleted, "deleted", []), true);
  assert.equal(matchesPortfolioLifecycle(deleted, "all", ["deleted"]), true);
  assert.equal(matchesPortfolioLifecycle(deleted, "all", ["planning", "deleted"]), true);
  assert.equal(matchesPortfolioLifecycle(deleted, "all", []), false);
  assert.equal(matchesPortfolioLifecycle({ status: "completed" }, "active", []), false);
  assert.equal(matchesPortfolioLifecycle({ status: "completed" }, "all", []), true);
  assert.equal(matchesPortfolioLifecycle({ status: "in_progress" }, "all", ["active"]), true);
});
test("saved status views opt into trash only with positive eq/in filters", () => {
  for (const filters of [
    [{ columnId: "status", op: "eq" as const, value: "deleted" }],
    [{ columnId: "status", op: "in" as const, value: ["active", "deleted"] }],
  ])
    assert.equal(viewRequestsDeletedProjects(filters), true);
  assert.equal(viewRequestsDeletedProjects([{ columnId: "status", op: "ne", value: "completed" }]), false);
  assert.equal(viewRequestsDeletedProjects([{ columnId: "title", op: "contains", value: "deleted" }]), false);
  assert.equal(matchesPortfolioLifecycle({ status: "deleted" }, "active", [], true), true);
  assert.equal(matchesPortfolioLifecycle({ status: "deleted" }, "completed", [], true), false);
});
test("adapter honors tombstones; a saved Deleted view sees only deleted rows", () => {
  const adapter = buildProjectAdapter({
    actorId: "u",
    workspaceId: "w",
    onUpdateProject: () => {},
    onArchiveProject: () => {},
    onOpenProject: () => {},
  });
  const rows = [
    { id: "live", status: "planning" },
    { id: "gone", status: "active", deletedAt: "2026-11-24T00:00:00Z" },
  ];
  const view = {
    ...adapter.defaultView("projects-list"),
    filters: [{ columnId: "status", op: "eq" as const, value: "deleted" }],
  };
  const scoped = rows.filter((row) =>
    matchesPortfolioLifecycle(row, "active", [], viewRequestsDeletedProjects(view.filters)),
  );
  assert.deepEqual(
    applyView(scoped, adapter, view, { userId: "u" }).rows.map((row) => row.id),
    ["gone"],
  );
  assert.equal(projectLifecycleStatus({ status: "active", deletedAt: null }), "active");
});
test("out-of-order role snapshots cannot resurrect a newer deletion, but Restore wins", () => {
  type Row = { id: string; status: string; updatedAt: { seconds: number; nanoseconds: number }; deletedAt?: unknown };
  const old: Row = { id: "p", status: "active", updatedAt: { seconds: 100, nanoseconds: 1 } };
  const deleted: Row = {
    ...old,
    status: "deleted",
    updatedAt: { seconds: 100, nanoseconds: 2 },
    deletedAt: new Date("2099-01-01"),
  };
  const restored: Row = { ...old, updatedAt: { seconds: 100, nanoseconds: 3 }, deletedAt: null };
  let latest: Row[] = [];
  const merge = createCompleteSnapshotMerge<Row>(
    2,
    (rows) => {
      latest = rows;
    },
    () => true,
    preferRecentProjectSnapshot,
  );
  merge.update(0, [old]);
  merge.update(1, [old]);
  merge.update(0, [deleted]);
  assert.equal(latest[0].status, "deleted");
  merge.update(1, [old]);
  assert.equal(latest[0].status, "deleted");
  merge.update(1, [restored]);
  assert.equal(latest[0].status, "active");
  merge.update(0, [deleted]);
  assert.equal(latest[0].status, "active");
});
test("project version reconciliation handles Date, ISO and legacy missing timestamps", () => {
  const old = { id: "p", updatedAt: "2026-11-01T00:00:00Z" };
  const recent = { id: "p", updatedAt: new Date("2026-11-24T00:00:00Z") };
  assert.equal(preferRecentProjectSnapshot(recent, old), recent);
  assert.equal(preferRecentProjectSnapshot(old, recent), recent);
  assert.equal(preferRecentProjectSnapshot(recent, { id: "p" }), recent);
});
test("portfolio and saved views use one lifecycle policy without changing destructive writes", () => {
  const parent = readFileSync("src/components/ProjectSurfaces.tsx", "utf8");
  const surface = readFileSync("src/features/views/ProjectsViewsSurface.tsx", "utf8");
  const data = readFileSync("src/data/startWorkspaceData.ts", "utf8");
  assert.match(parent, /matchesPortfolioLifecycle\(project, filter, statusFilters/);
  assert.match(parent, /onDeletedViewChange=\{setSavedViewRequestsDeleted\}/);
  assert.match(surface, /viewRequestsDeletedProjects\(listView.filters\)/);
  assert.match(data, /name === "projects" \? preferRecentProjectSnapshot : undefined/);
});
