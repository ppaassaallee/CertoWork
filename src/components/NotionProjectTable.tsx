import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, Plus } from "./ui/Icon";
import {
  HierarchyChevron,
  WorkItemTypeGlyph,
} from "../features/projects/chrome";
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
import {
  allowedChildKinds,
  hierarchyChildren,
  hierarchyKind,
  hierarchyRoots,
  sortHierarchyForest,
  sortHierarchySiblings,
  treeNodeExpandedByDefault,
} from "../lib/itemHierarchy";
import { type SprintRecord } from "../lib/sprints";
import { taskWorkLane } from "../lib/projectPortfolio";

type NotionRow = {
  id: string;
  item: any;
  title: string;
  status: string;
  statusLabel: string;
  statusTone: ReturnType<typeof notionStatusTone>;
  start: string;
  end: string;
  progress: number;
  estimate: number;
  difficulty: ReturnType<typeof notionDifficulty>;
  depth: number;
  childCount: number;
  hasChildren: boolean;
  kind: string;
};

const columnHelper = createColumnHelper<NotionRow>();

function itemTitle(item: any) {
  return String(item?.title || item?.name || item?.summary || "Untitled").trim();
}

function buildVisibleRows(
  tasks: any[],
  expanded: Set<string>,
): NotionRow[] {
  const forest = sortHierarchyForest(tasks);
  const byId = new Map(forest.map((item) => [String(item.id), item]));
  const rows: NotionRow[] = [];

  const walk = (item: any, depth: number) => {
    const id = String(item.id);
    const children = sortHierarchySiblings(hierarchyChildren(tasks, id));
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(id);
    const status = taskWorkLane(item);
    const progress = checklistProgress(checklistItems(item)).percent;
    rows.push({
      id,
      item,
      title: itemTitle(item),
      status,
      statusLabel: notionStatusLabel(status),
      statusTone: notionStatusTone(status),
      start: notionShortDate(notionStartDate(item)),
      end: notionShortDate(notionEndDate(item)),
      progress,
      estimate: notionEstimateHours(item),
      difficulty: notionDifficulty(item.priority || item.priorityLevel),
      depth,
      childCount: children.length,
      hasChildren,
      kind: hierarchyKind(item),
    });
    if (hasChildren && isExpanded) {
      children.forEach((child) => {
        if (byId.has(String(child.id))) walk(child, depth + 1);
      });
    }
  };

  sortHierarchySiblings(hierarchyRoots(tasks)).forEach((root) => walk(root, 0));
  // Orphans already handled by sortHierarchyForest roots; include any leftover
  for (const item of forest) {
    if (!rows.some((row) => row.id === String(item.id))) walk(item, 0);
  }
  return rows;
}

function defaultCreateKind(parent: any | null) {
  if (!parent) return "pbi";
  const children = allowedChildKinds(hierarchyKind(parent));
  if (children.includes("pbi")) return "pbi";
  if (children.includes("task")) return "task";
  if (children.includes("subtask")) return "subtask";
  return children[0] || "pbi";
}

export function NotionProjectTable({
  tasks,
  sprints: _sprints = [],
  onSelectItem,
  onAddItem,
  selectedItemId,
}: {
  tasks: any[];
  sprints?: SprintRecord[];
  onSelectItem: (id: string) => void;
  onAddItem: (title: string, patch?: Record<string, unknown>) => void;
  selectedItemId?: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [createKind, setCreateKind] = useState("pbi");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Expand parents that default open for this visit when first seen with children
  useMemo(() => {
    const next = new Set(expanded);
    let changed = false;
    for (const item of tasks) {
      const id = String(item.id);
      const kids = hierarchyChildren(tasks, id);
      if (
        kids.length &&
        treeNodeExpandedByDefault(hierarchyKind(item), 0) &&
        !next.has(id) &&
        !expanded.has(`seen:${id}`)
      ) {
        // defaults are collapsed per itemHierarchy — leave collapsed
      }
      void changed;
    }
    return next;
  }, [tasks, expanded]);

  const rows = useMemo(
    () => buildVisibleRows(tasks, expanded),
    [tasks, expanded],
  );

  const estimateSum = useMemo(
    () => rows.reduce((sum, row) => sum + row.estimate, 0),
    [rows],
  );

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Nombre",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div
              className="do-notion-name-cell"
              style={{ paddingLeft: `${row.depth * 22}px` }}
            >
              {row.hasChildren ? (
                <HierarchyChevron
                  expanded={expanded.has(row.id)}
                  onToggle={() => toggleExpanded(row.id)}
                />
              ) : (
                <span className="do-hierarchy-chevron-spacer" />
              )}
              <WorkItemTypeGlyph item={row.item} />
              <button
                className="do-notion-title-cell"
                onClick={() => onSelectItem(row.id)}
                type="button"
              >
                {info.getValue()}
              </button>
              {row.childCount > 0 ? (
                <span className="do-notion-child-count">{row.childCount}</span>
              ) : null}
            </div>
          );
        },
        size: 260,
      }),
      columnHelper.accessor("statusLabel", {
        header: "Estado",
        cell: (info) => (
          <span className={`do-notion-chip is-${info.row.original.statusTone}`}>
            {info.getValue()}
          </span>
        ),
        size: 100,
      }),
      columnHelper.accessor("start", {
        header: "Inicio",
        cell: (info) => <span className="do-notion-muted">{info.getValue()}</span>,
        size: 64,
      }),
      columnHelper.accessor("end", {
        header: "Fin",
        cell: (info) => <span className="do-notion-muted">{info.getValue()}</span>,
        size: 64,
      }),
      columnHelper.accessor("progress", {
        header: "Progreso",
        cell: (info) => (
          <span className="do-notion-progress">
            <span className="do-notion-muted">{info.getValue()}%</span>
            <span className="do-notion-bar" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(100, info.getValue()))}%` }} />
            </span>
          </span>
        ),
        size: 88,
      }),
      columnHelper.accessor("estimate", {
        header: "ET",
        cell: (info) => (
          <span className="do-notion-muted">{info.getValue() || ""}</span>
        ),
        size: 40,
      }),
      columnHelper.accessor((row) => row.difficulty.label, {
        id: "difficulty",
        header: "Dificultad",
        cell: (info) =>
          info.row.original.difficulty.label ? (
            <span className={`do-notion-chip is-${info.row.original.difficulty.tone}`}>
              {info.row.original.difficulty.label}
            </span>
          ) : null,
        size: 80,
      }),
    ],
    [onSelectItem, expanded],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const submitNew = () => {
    const title = draft.trim();
    if (!title) return;
    onAddItem(title, { workItemType: createKind, type: createKind, itemType: createKind });
    setDraft("");
    setCreateKind(defaultCreateKind(null));
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
          {table.getRowModel().rows.map((row) => (
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
          ))}
          <tr className="do-notion-add-row">
            <td colSpan={7}>
              <form
                className="do-notion-add-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitNew();
                }}
              >
                <Plus size={13} />
                <span className="do-notion-add-label">Nueva</span>
                <label className="do-notion-type-chip">
                  <span className="sr-only">Tipo</span>
                  <select
                    aria-label="Tipo de ítem"
                    onChange={(event) => setCreateKind(event.target.value)}
                    value={createKind}
                  >
                    <option value="epic">Epic</option>
                    <option value="feature">Feature</option>
                    <option value="pbi">PBI</option>
                    <option value="story">Story</option>
                    <option value="task">Task</option>
                    <option value="bug">Bug</option>
                    <option value="subtask">Subtask</option>
                  </select>
                  <ChevronDown size={10} aria-hidden="true" />
                </label>
                <input
                  aria-label="Nueva"
                  onChange={(event) => setDraft(event.target.value)}
                  onFocus={() => setCreateKind((current) => current || "pbi")}
                  placeholder=""
                  value={draft}
                />
                <span className="do-notion-add-hint">Tab = subtarea</span>
              </form>
            </td>
          </tr>
        </tbody>
        {estimateSum > 0 ? (
          <tfoot>
            <tr>
              <td colSpan={5} />
              <td>
                <span className="do-notion-sum">
                  <em>SUM</em> {estimateSum}
                </span>
              </td>
              <td />
            </tr>
          </tfoot>
        ) : null}
      </table>
      {rows.length === 0 && (
        <p className="do-notion-empty">Todavía no hay ítems. Escribí el primero en Nueva.</p>
      )}
    </div>
  );
}
