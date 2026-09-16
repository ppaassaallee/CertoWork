import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  canSeeTable,
  isActiveTable,
  tableLifecycleStatus,
} from "../src/lib/tables/storage";
import type { TableDoc } from "../src/lib/tables/types";
import { TABLE_ITEM_RELATION } from "../src/lib/tables/types";

const root = resolve(import.meta.dirname, "..");

function baseTable(overrides: Partial<TableDoc> = {}): TableDoc {
  return {
    id: "tbl_1",
    workspaceId: "ws_1",
    projectId: null,
    name: "Vendors",
    icon: "▦",
    color: "#3C3489",
    visibility: "workspace",
    columns: [{ id: "title", name: "Title", type: "text", required: true }],
    keyColumns: { title: "title", status: null, owner: null, date: null },
    recordCount: 0,
    itemCount: 0,
    templateId: null,
    status: "active",
    createdBy: "user_1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("tableLifecycleStatus defaults missing status to active", () => {
  assert.equal(tableLifecycleStatus({}), "active");
  assert.equal(tableLifecycleStatus({ status: "archived" }), "archived");
  assert.equal(tableLifecycleStatus({ status: "deleted" }), "deleted");
});

test("canSeeTable hides archived and deleted by default", () => {
  const uid = "user_1";
  assert.equal(canSeeTable(baseTable(), uid, []), true);
  assert.equal(canSeeTable(baseTable({ status: "archived" }), uid, []), false);
  assert.equal(canSeeTable(baseTable({ status: "deleted" }), uid, []), false);
  assert.equal(
    canSeeTable(baseTable({ status: "archived" }), uid, [], { includeArchived: true }),
    true,
  );
  assert.equal(
    canSeeTable(baseTable({ status: "deleted" }), uid, [], { includeDeleted: true }),
    true,
  );
});

test("isActiveTable only accepts active lifecycle", () => {
  assert.equal(isActiveTable(baseTable()), true);
  assert.equal(isActiveTable(baseTable({ status: "archived" })), false);
  assert.equal(isActiveTable(baseTable({ status: undefined })), true);
});

test("storage exports archive/delete/item membership helpers", () => {
  const storage = readFileSync(resolve(root, "src/lib/tables/storage.ts"), "utf8");
  assert.match(storage, /export async function archiveTable/);
  assert.match(storage, /export async function softDeleteTable/);
  assert.match(storage, /export async function restoreTable/);
  assert.match(storage, /export async function permanentlyDeleteTable/);
  assert.match(storage, /export async function linkTableItem/);
  assert.match(storage, /export async function unlinkTableItem/);
  assert.match(storage, /export async function listTableItems/);
  assert.match(storage, /BATCH_LIMIT = 400/);
  assert.match(storage, /queryWorkspaceChildren/);
  assert.match(storage, /where\("workspaceId", "==",/);
  assert.equal(TABLE_ITEM_RELATION, "table_item");
});

test("TablePage exposes archive/delete and Items tab", () => {
  const page = readFileSync(resolve(root, "src/features/tables/TablePage.tsx"), "utf8");
  assert.match(page, /tables-archive/);
  assert.match(page, /tables-delete/);
  assert.match(page, /tables-tab-\$\{id\}/);
  assert.match(page, /\["items", t\("tables\.tabs\.items"\)/);
  assert.match(page, /TableItemsPanel/);
  assert.match(page, /onArchiveTable/);
  assert.match(page, /onDeleteTable/);
});

test("sidebar wires archive and delete table actions", () => {
  const shell = readFileSync(
    resolve(root, "src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  assert.match(shell, /archiveWorkspaceTable/);
  assert.match(shell, /deleteWorkspaceTable/);
  assert.match(shell, /permanentlyDeleteWorkspaceTable/);
  assert.match(shell, /permanentlyDeleteTable\(table\.id, table\.workspaceId\)/);
  assert.match(shell, /archivedTables/);
  assert.match(shell, /deletedTables/);
  assert.match(shell, /itemCandidates=/);
  assert.match(shell, /tables\.items\.general/);
  assert.match(shell, /flashNotice/);
  assert.match(shell, /tableActionError/);
  assert.match(shell, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(
    shell,
    /archive-table-[\s\S]{0,200}do-mobile-advanced/,
  );
});

test("table page menu stacks above body so archive/delete are clickable", () => {
  const css = readFileSync(resolve(root, "src/styles/certo-tokens.css"), "utf8");
  assert.match(css, /\.cw-tables-page-header\s*\{[^}]*z-index:\s*50/s);
  assert.match(css, /\.cw-tables-menu-wrap \.cw-tables-popover\s*\{[^}]*z-index:\s*60/s);
});

test("firestore rules let workspace members write non-private tables", () => {
  const rules = readFileSync(resolve(root, "firestore.rules"), "utf8");
  const writeFn = rules.match(/function canWriteTable\(data\)\s*\{[\s\S]*?\n {4}\}/)?.[0] || "";
  assert.match(writeFn, /visibility != 'private'/);
  assert.match(writeFn, /!\('visibility' in data\)/);
  assert.doesNotMatch(writeFn, /data\.visibility == 'project'/);
});

test("firestore indexes cover table cascade delete queries", () => {
  const indexes = readFileSync(resolve(root, "firestore.indexes.json"), "utf8");
  assert.match(indexes, /"collectionGroup": "table_records"/);
  assert.match(indexes, /"collectionGroup": "table_record_activity"/);
  assert.match(indexes, /"collectionGroup": "table_forms"/);
  assert.match(indexes, /"fieldPath": "tableId"/);
  assert.match(indexes, /"fieldPath": "recordId"/);
});

test("table forms list scopes by workspaceId", () => {
  const forms = readFileSync(resolve(root, "src/lib/tables/tableForms.ts"), "utf8");
  assert.match(forms, /export async function listTableForms/);
  assert.match(forms, /where\("workspaceId", "==", workspaceId\)/);
  assert.match(forms, /where\("tableId", "==", tableId\)/);
});

test("TableItemsPanel supports associated vs general filters", () => {
  const panel = readFileSync(
    resolve(root, "src/features/tables/TableItemsPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /filterAssociated/);
  assert.match(panel, /filterGeneral/);
  assert.match(panel, /linkTableItem/);
  assert.match(panel, /unlinkTableItem/);
});

test("RecordPanel lists and unlinks record links", () => {
  const panel = readFileSync(
    resolve(root, "src/features/tables/RecordPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /listRecordLinks/);
  assert.match(panel, /unlinkRecord/);
  assert.match(panel, /tables-record-links/);
  assert.match(panel, /linkedEmpty/);
});
