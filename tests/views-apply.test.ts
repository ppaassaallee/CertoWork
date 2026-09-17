import assert from "node:assert/strict";
import test from "node:test";
import { applyView } from "../src/lib/views/apply";
import type { EntityAdapter, SavedView } from "../src/lib/views/types";

type Row = {
  id: string;
  title: string;
  status: string;
  assigneeId: string | null;
  dueDate: string | null;
  parentId: string | null;
  order: number;
};

const adapter: EntityAdapter<Row> = {
  kind: "task",
  rowId: (row) => row.id,
  parentId: (row) => row.parentId,
  columns: [
    {
      id: "title",
      label: "Title",
      type: "text",
      read: (row) => row.title,
      render: "hierarchy",
    },
    {
      id: "status",
      label: "Status",
      type: "status",
      read: (row) => row.status,
      options: () => [
        { id: "open", label: "Open", tone: "neutral" },
        { id: "done", label: "Done", tone: "success" },
        { id: "blocked", label: "Blocked", tone: "danger" },
      ],
    },
    {
      id: "assignee",
      label: "Assignee",
      type: "person",
      read: (row) => row.assigneeId,
    },
    {
      id: "due",
      label: "Due",
      type: "date",
      read: (row) => row.dueDate,
    },
    {
      id: "order",
      label: "Order",
      type: "number",
      read: (row) => row.order,
    },
  ],
  actions: [],
  defaultView: () => baseView(),
};

function baseView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: "default",
    workspaceId: "ws",
    surface: "my-work",
    name: "Default",
    scope: "personal",
    ownerId: "u1",
    layout: "table",
    columns: [{ id: "title" }, { id: "status" }, { id: "assignee" }, { id: "due" }],
    quickActions: [],
    filters: [],
    sort: [],
    groupBy: null,
    density: "comfortable",
    showSubtasks: false,
    isDefault: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

const NOW = new Date("2026-09-17T12:00:00.000Z");
const ROWS: Row[] = [
  {
    id: "parent",
    title: "Parent",
    status: "open",
    assigneeId: "u1",
    dueDate: "2026-09-20",
    parentId: null,
    order: 2,
  },
  {
    id: "child",
    title: "Child",
    status: "blocked",
    assigneeId: "u2",
    dueDate: "2026-09-10",
    parentId: "parent",
    order: 1,
  },
  {
    id: "mine-overdue",
    title: "Mine overdue",
    status: "open",
    assigneeId: "u1",
    dueDate: "2026-09-01",
    parentId: null,
    order: 3,
  },
  {
    id: "done-old",
    title: "Done old",
    status: "done",
    assigneeId: "u1",
    dueDate: "2026-08-01",
    parentId: null,
    order: 0,
  },
];

test("filter me keeps only current user rows", () => {
  const result = applyView(
    ROWS,
    adapter,
    baseView({ filters: [{ columnId: "assignee", op: "me" }] }),
    { userId: "u1", now: NOW },
  );
  assert.deepEqual(
    result.rows.map((row) => row.id).sort(),
    ["done-old", "mine-overdue", "parent"],
  );
});

test("filter overdue excludes done and future dates", () => {
  const result = applyView(
    ROWS,
    adapter,
    baseView({ filters: [{ columnId: "due", op: "overdue" }] }),
    { userId: "u1", now: NOW },
  );
  assert.deepEqual(
    result.rows.map((row) => row.id).sort(),
    ["child", "mine-overdue"],
  );
});

test("sorts by two columns", () => {
  const result = applyView(
    ROWS,
    adapter,
    baseView({
      sort: [
        { columnId: "status", dir: "asc" },
        { columnId: "order", dir: "asc" },
      ],
    }),
    { userId: "u1", now: NOW },
  );
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["child", "done-old", "parent", "mine-overdue"],
  );
});

test("groups by status using option labels", () => {
  const result = applyView(
    ROWS,
    adapter,
    baseView({ groupBy: "status" }),
    { userId: "u1", now: NOW },
  );
  assert.equal(result.groups[0]?.label, "Open");
  assert.equal(result.groups.find((g) => g.key === "blocked")?.label, "Blocked");
  assert.ok(result.groups.every((g) => g.rows.length > 0));
});

test("hierarchy keeps child under parent after sort", () => {
  const result = applyView(
    ROWS,
    adapter,
    baseView({
      showSubtasks: true,
      sort: [{ columnId: "order", dir: "asc" }],
    }),
    { userId: "u1", now: NOW },
  );
  const ids = result.rows.map((row) => row.id);
  const parentIndex = ids.indexOf("parent");
  const childIndex = ids.indexOf("child");
  assert.ok(parentIndex >= 0);
  assert.equal(childIndex, parentIndex + 1);
});
