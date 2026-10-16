import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { sharedTableRecords } from "../src/lib/tables/readableQueries";
import type { RecordDoc } from "../src/lib/tables/types";

const record = (id: string, order: number, tableId = "table-a", workspaceId = "workspace-a"): RecordDoc => ({
  id, order, tableId, workspaceId, values: {}, createdAt: "", updatedAt: "", createdBy: "fixture",
});

test("shared records preserve tenant and table scope without mutating the shared snapshot", () => {
  const records = [record("last", 3), record("other-table", 0, "table-b"), record("second", 1), record("first", 1), record("other-tenant", 0, "table-a", "workspace-b")];
  const before = [...records];
  assert.deepEqual(sharedTableRecords("workspace-a", "table-a", ["table-a", "table-b"], records, true)?.map((row) => row.id), ["first", "second", "last"]);
  assert.deepEqual(records, before);
});

test("empty shared snapshots remain owned and never start a duplicate listener", () => {
  assert.deepEqual(sharedTableRecords("workspace-a", "table-a", ["table-a"], [], true), []);
});

test("unsubscribed archived or deleted tables retain their own listener", () => {
  assert.equal(sharedTableRecords("workspace-a", "archived", ["table-a"], [], true), undefined);
  assert.equal(sharedTableRecords("workspace-a", "table-a", ["table-a"], [], false), undefined);
  assert.equal(sharedTableRecords("", "table-a", ["table-a"], [], true), undefined);
});

test("shell passes the shared snapshot and TablePage retains its standalone mode", () => {
  const shell = readFileSync(new URL("../src/components/DelivereeWorkspace.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/features/tables/TablePage.tsx", import.meta.url), "utf8");
  assert.match(shell, /<TablePage\s+records=\{activeTableSharedRecords\}/);
  assert.match(shell, /joinedWorkspace && !workspaceRecordsReadFailed/);
  assert.match(shell, /logFirestoreListenError\(`table_records \$\{index\}`, error\);\s+setWorkspaceRecordsReadFailed\(true\)/);
  assert.match(page, /const ownsData = recordsProp === undefined/);
  assert.match(page, /if \(!ownsData\) return/);
});
