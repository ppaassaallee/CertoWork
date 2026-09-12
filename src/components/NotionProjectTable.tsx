import { Fragment, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
} from "@tanstack/react-table";
import { ChevronDown, Plus } from "./ui/Icon";
import {
  notionDifficulty,
  notionEndDate,
  notionEstimateHours,
  notionShortDate,
  notionStartDate,
  notionStatusLabel,
  notionStatusTone,
} from "../lib/notionProjectTable";
import { checklistItems, checklistProgress } from "../lib/kanbanFeatures";
import { hierarchyKind, normalizeItemId, visibleParentId, presentItemIds } from "../lib/itemHierarchy";
import { type SprintRecord } from "../lib/sprints";
import { taskWorkLane } from "../lib/projectPortfolio";

type NotionRow = {
  id: string;
  title: string;
  kind: string;
  depth: number;
  status: string;
  statusLabel: string;
  statusTone: ReturnType<typeof notionStatusTone>;
  start: string;
  end: string;
  progress: number;
  estimate: number;
  difficulty: ReturnType<typeof notionDifficulty>;
  sprintKey: string;
  sprintLabel: string;
  assignee: string;
};

const columnHelper = createColumnHelper<NotionRow>();

function itemTitle(item: any) {
  return String(item?.title || item?.name || item?.summary || "Untitled").trim();
}

function assigneeLabel(item: any) {
  if (Array.isArray(item?.assignees) && item.assignees[0]) return String(item.assignees[0]).trim();
  return String(item?.owner || item?.assignee || "").trim();
}

function sprintMeta(item: any, sprints: SprintRecord[]) {
  const sprintId = String(item?.sprintId || "").trim();
  if (!sprintId) return { key: "none", label: "No sprint" };
  const match = sprints.find((sprint) => sprint.id === sprintId);
  const name = String(match?.name || item?.sprint || "Sprint").trim();
  const num = name.match(/\d+/);
  return { key: sprintId, label: num?.[0] ? `Sprint ${num[0]}` : name };
}

function depthOf(item: any, byId: Map<string, any>, present: Set<string>) {
  let depth = 0;
  let current = visibleParentId(item, present);
  const seen = new Set<string>();
  while (current && byId.has(current) && depth < 6 && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    current = visibleParentId(byId.get(current), present);
  }
  return depth;
}

export function NotionProjectTable({
  tasks,
  sprints = [],
  onSelectItem,
  onAddItem,
  selectedItemId,
}: {
  tasks: any[];
  sprints?: SprintRecord[];
  onSelectItem: (id: string) => void;
  onAddItem: (title: string) => void;
  selectedItemId?: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  const rows = useMemo<NotionRow[]>(() => {
    const present = presentItemIds(tasks);
    const byId = new Map(tasks.map((item) => [normalizeItemId(item?.id), item]));
    return tasks.map((item) => {
      const status = taskWorkLane(item);
      const progress = checklistProgress(checklistItems(item)).percent;
      const sprint = sprintMeta(item, sprints);
      return {
        id: String(item.id),
        title: itemTitle(item),
        kind: hierarchyKind(item),
        depth: depthOf(item, byId, present),
        status,
        statusLabel: notionStatusLabel(status),
        statusTone: notionStatusTone(status),
        start: notionShortDate(notionStartDate(item)),
        end: notionShortDate(notionEndDate(item)),
        progress,
        estimate: notionEstimateHours(item),
        difficulty: notionDifficulty(item.priority || item.priorityLevel),
        sprintKey: sprint.key,
        sprintLabel: sprint.label,
        assignee: assigneeLabel(item),
      };
    });
  }, [tasks, sprints]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; rows: NotionRow[] }>();
    for (const row of rows) {
      const current = map.get(row.sprintKey) || { key: row.sprintKey, label: row.sprintLabel, rows: [] };
      current.rows.push(row);
      map.set(row.sprintKey, current);
    }
    return [...map.values()].sort((left, right) => {
      if (left.key === "none") return 1;
      if (right.key === "none") return -1;
      return left.label.localeCompare(right.label);
    });
  }, [rows]);

  const estimateSum = useMemo(
    () => rows.reduce((sum, row) => sum + row.estimate, 0),
    [rows],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("sprintLabel", {
        header: "Sprint",
        cell: (info) => (
          <span className="do-notion-num do-notion-muted">
            {info.row.original.sprintKey === "none" ? "" : info.getValue().replace(/^Sprint\s+/i, "")}
          </span>
        ),
        size: 56,
      }),
      columnHelper.accessor("title", {
        header: "Name",
        cell: (info) => (
          <button
            className="do-notion-title-cell"
            data-depth={Math.min(info.row.original.depth, 3)}
            onClick={() => onSelectItem(info.row.original.id)}
            type="button"
          >
            <span className="do-notion-kind">{info.row.original.kind}</span>
            <span className="do-notion-title-text">{info.getValue()}</span>
          </button>
        ),
        size: 280,
      }),
      columnHelper.accessor("statusLabel", {
        header: "Status",
        cell: (info) => (
          <span className={`do-notion-chip is-${info.row.original.statusTone}`}>
            {info.getValue()}
          </span>
        ),
        size: 110,
      }),
      columnHelper.accessor("start", {
        header: "Start",
        cell: (info) => <span className="do-notion-num do-notion-muted">{info.getValue()}</span>,
        size: 72,
      }),
      columnHelper.accessor("end", {
        header: "End",
        cell: (info) => <span className="do-notion-num do-notion-muted">{info.getValue()}</span>,
        size: 72,
      }),
      columnHelper.accessor("progress", {
        header: "Progress",
        cell: (info) => (
          <span className="do-notion-progress">
            <span className="do-notion-num do-notion-muted">{info.getValue()}%</span>
            <span className="do-notion-bar" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(100, info.getValue()))}%` }} />
            </span>
          </span>
        ),
        size: 96,
      }),
      columnHelper.accessor("estimate", {
        header: "ET",
        cell: (info) => (
          <span className="do-notion-num do-notion-muted">{info.getValue() || ""}</span>
        ),
        size: 44,
      }),
      columnHelper.accessor((row) => row.difficulty.label, {
        id: "difficulty",
        header: "Difficulty",
        cell: (info) => (
          <span className={`do-notion-chip is-${info.row.original.difficulty.tone}`}>
            {info.row.original.difficulty.label}
          </span>
        ),
        size: 88,
      }),
      columnHelper.accessor("assignee", {
        header: "",
        cell: (info) => {
          const name = info.getValue();
          if (!name) return null;
          const initial = name.charAt(0).toUpperCase();
          return (
            <span className="do-notion-avatar" title={name} aria-label={name}>
              {initial}
            </span>
          );
        },
        size: 40,
      }),
    ],
    [onSelectItem],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rowsById = useMemo(() => {
    const map = new Map<string, Row<NotionRow>>();
    for (const row of table.getRowModel().rows) map.set(row.original.id, row);
    return map;
  }, [table, rows]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
  };

  return (
    <div className="do-notion-table-wrap" data-testid="notion-project-table">
      <table className="do-notion-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} style={{ width: header.getSize() }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {groups.map((group) => {
            const collapsed = collapsedGroups.includes(group.key);
            return (
              <Fragment key={`group-${group.key}`}>
                <tr className="do-notion-group-row">
                  <td colSpan={columns.length}>
                    <button
                      className="do-notion-group-head"
                      onClick={() => toggleGroup(group.key)}
                      type="button"
                    >
                      <ChevronDown className={collapsed ? "is-collapsed" : ""} size={13} />
                      <strong>{group.label}</strong>
                      <span className="do-notion-num">{group.rows.length}</span>
                    </button>
                  </td>
                </tr>
                {!collapsed &&
                  group.rows.map((rowData) => {
                    const row = rowsById.get(rowData.id);
                    if (!row) return null;
                    return (
                      <tr
                        className={selectedItemId === row.original.id ? "is-selected" : ""}
                        key={row.id}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
          <tr className="do-notion-add-row">
            <td />
            <td colSpan={columns.length - 1}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const title = draft.trim();
                  if (!title) return;
                  onAddItem(title);
                  setDraft("");
                }}
              >
                <Plus size={14} />
                <input
                  aria-label="New task"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="+ New"
                  value={draft}
                />
              </form>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} />
            <td>
              <span className="do-notion-sum">
                <em>SUM</em> <span className="do-notion-num">{estimateSum || ""}</span>
              </span>
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
      {rows.length === 0 && (
        <p className="do-notion-empty">No items yet. Add the first one below.</p>
      )}
    </div>
  );
}
