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

test("filter me matches workspace member ids, not only Firebase uid", () => {
  const rows: Row[] = [
    {
      id: "member-assigned",
      title: "Assigned via member id",
      status: "open",
      assigneeId: "ws_u1",
      dueDate: "2026-09-17",
      parentId: null,
      order: 1,
    },
    {
      id: "other",
      title: "Someone else",
      status: "open",
      assigneeId: "ws_u2",
      dueDate: "2026-09-17",
      parentId: null,
      order: 2,
    },
  ];
  const withoutAliases = applyView(
    rows,
    adapter,
    baseView({ filters: [{ columnId: "assignee", op: "me" }] }),
    { userId: "u1", now: NOW },
  );
  assert.deepEqual(
    withoutAliases.rows.map((row) => row.id),
    [],
  );

  const withAliases = applyView(
    rows,
    adapter,
    baseView({ filters: [{ columnId: "assignee", op: "me" }] }),
    { userId: "u1", memberIds: ["ws_u1"], now: NOW },
  );
  assert.deepEqual(
    withAliases.rows.map((row) => row.id),
    ["member-assigned"],
  );
});

test("filter me matches assigneeIds arrays from taskAdapter", () => {
  type Taskish = Row & { assigneeIds?: string[] };
  const taskAdapter: EntityAdapter<Taskish> = {
    ...adapter,
    columns: adapter.columns.map((col) =>
      col.id === "assignee"
        ? {
            ...col,
            read: (row) =>
              Array.isArray(row.assigneeIds) && row.assigneeIds.length
                ? row.assigneeIds
                : row.assigneeId,
          }
        : col,
    ) as EntityAdapter<Taskish>["columns"],
  };
  const rows: Taskish[] = [
    {
      id: "arr",
      title: "Array assignees",
      status: "open",
      assigneeId: "ws_u1",
      assigneeIds: ["ws_u1"],
      dueDate: "2026-09-17",
      parentId: null,
      order: 1,
    },
  ];
  const result = applyView(
    rows,
    taskAdapter,
    baseView({
      filters: [
        { columnId: "assignee", op: "me" },
        { columnId: "due", op: "today" },
      ],
    }),
    { userId: "u1", memberIds: ["ws_u1"], now: NOW },
  );
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["arr"],
  );
});

test("filter today includes timeSector / One Thing without dueDate", () => {
  type SectorRow = Row & { timeSector?: string; timeSectorDate?: string; isOneThing?: boolean };
  const sectorAdapter: EntityAdapter<SectorRow> = {
    ...adapter,
    columns: adapter.columns as EntityAdapter<SectorRow>["columns"],
  };
  const rows: SectorRow[] = [
    {
      id: "sector-today",
      title: "Pinned today",
      status: "open",
      assigneeId: "u1",
      dueDate: null,
      parentId: null,
      order: 1,
      timeSector: "today",
      timeSectorDate: "2026-09-17",
    },
    {
      id: "one-thing",
      title: "One thing",
      status: "open",
      assigneeId: "u1",
      dueDate: null,
      parentId: null,
      order: 2,
      isOneThing: true,
    },
  ];
  const result = applyView(
    rows,
    sectorAdapter,
    baseView({ filters: [{ columnId: "due", op: "today" }] }),
    { userId: "u1", now: NOW },
  );
  assert.deepEqual(
    result.rows.map((row) => row.id).sort(),
    ["one-thing", "sector-today"],
  );
});

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

test("filters today and week date windows", () => {
  const withToday: typeof ROWS = [
    ...ROWS,
    {
      id: "due-today",
      title: "Due today",
      status: "open",
      assigneeId: "u1",
      dueDate: "2026-09-17",
      parentId: null,
      order: 9,
    },
    {
      id: "due-sat",
      title: "Due Saturday",
      status: "open",
      assigneeId: "u1",
      dueDate: "2026-09-19",
      parentId: null,
      order: 8,
    },
  ];
  const todayRows = applyView(
    withToday,
    adapter,
    baseView({ filters: [{ columnId: "due", op: "today" }] }),
    { userId: "u1", now: NOW },
  );
  assert.deepEqual(
    todayRows.rows.map((row) => row.id),
    ["due-today"],
  );

  const weekRows = applyView(
    withToday,
    adapter,
    baseView({ filters: [{ columnId: "due", op: "week" }] }),
    { userId: "u1", now: NOW },
  );
  // Thu 2026-09-17 → Sat 2026-09-19 inclusive.
  assert.deepEqual(
    weekRows.rows.map((row) => row.id).sort(),
    ["due-sat", "due-today"],
  );
});
