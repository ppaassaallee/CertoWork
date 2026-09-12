import { useMemo, useState, type ReactNode } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, GripVertical, Plus } from "./ui/Icon";
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
  canNestUnder,
  hierarchyChildren,
  hierarchyKind,
  hierarchyRoots,
  normalizeItemId,
  parentLinkPatch,
  sortHierarchyForest,
  sortHierarchySiblings,
  treeNodeExpandedByDefault,
  visibleParentId,
  wouldCreateHierarchyCycle,
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
/** Clearer hierarchy indent than a flat list — ~1 tab per level. */
const HIERARCHY_INDENT_PX = 24;

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
  for (const item of forest) {
    if (!rows.some((row) => row.id === String(item.id))) walk(item, 0);
  }
  return rows;
}

function defaultCreateKind(parent: any | null) {
  if (!parent) return "feature";
  const children = allowedChildKinds(hierarchyKind(parent));
  if (children.includes("feature")) return "feature";
  if (children.includes("pbi")) return "pbi";
  if (children.includes("subtask")) return "subtask";
  if (children.includes("task")) return "task";
  return children[0] || "pbi";
}

export function NotionProjectTable({
  tasks,
  hierarchyPool,
  sprints: _sprints = [],
  onSelectItem,
  onAddItem,
  onUpdateTask,
  onReorderPeers,
  renderAttrs,
  selectedItemId,
}: {
  tasks: any[];
  /** Full project pool for parent/cycle checks (defaults to `tasks`). */
  hierarchyPool?: any[];
  sprints?: SprintRecord[];
  onSelectItem: (id: string) => void;
  onAddItem: (title: string, patch?: Record<string, unknown>) => void;
  onUpdateTask?: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onReorderPeers?: (draggedId: string, targetId: string, peers: any[]) => Promise<void> | void;
  renderAttrs?: (item: any) => ReactNode;
  selectedItemId?: string | null;
}) {
  const pool = hierarchyPool?.length ? hierarchyPool : tasks;
  const [draft, setDraft] = useState("");
  const [createKind, setCreateKind] = useState("pbi");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<"child" | "reorder" | null>(null);

  useMemo(() => {
    const next = new Set(expanded);
    for (const item of tasks) {
      const id = String(item.id);
      const kids = hierarchyChildren(tasks, id);
      if (
        kids.length &&
        treeNodeExpandedByDefault(hierarchyKind(item), 0) &&
        !next.has(id)
      ) {
        // defaults stay collapsed
      }
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

  const byId = useMemo(
    () => new Map(pool.map((item) => [normalizeItemId(item?.id), item])),
    [pool],
  );
  const presentIds = useMemo(
    () => new Set(pool.map((item) => normalizeItemId(item?.id)).filter(Boolean)),
    [pool],
  );

  const resolveDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return null;
    const dragged = byId.get(draggedId);
    const target = byId.get(targetId);
    if (!dragged || !target) return null;
    const childKind = hierarchyKind(dragged);
    const parentKind = hierarchyKind(target);
    if (
      canNestUnder(childKind, parentKind) &&
      !wouldCreateHierarchyCycle(dragged, target, pool)
    ) {
      return { mode: "child" as const, dragged, target };
    }
    const draggedParent = visibleParentId(dragged, presentIds);
    const targetParent = visibleParentId(target, presentIds);
    if (draggedParent === targetParent) {
      return { mode: "reorder" as const, dragged, target };
    }
    return null;
  };

  const applyDrop = async (targetId: string) => {
    const resolved = resolveDrop(targetId);
    if (!resolved || !draggedId) return;
    if (resolved.mode === "child") {
      await onUpdateTask?.(draggedId, parentLinkPatch(resolved.target));
      setExpanded((current) => new Set(current).add(targetId));
      return;
    }
    const parent = visibleParentId(resolved.dragged, presentIds);
    const peers = parent
      ? hierarchyChildren(pool, parent)
      : hierarchyRoots(pool);
    await onReorderPeers?.(draggedId, targetId, peers);
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
              style={{ paddingLeft: `${row.depth * HIERARCHY_INDENT_PX}px` }}
            >
              <button
                aria-label={`Drag to nest or reorder ${row.title}`}
                className="do-notion-drag-handle"
                draggable
                onDragEnd={() => {
                  setDraggedId(null);
                  setDropTargetId(null);
                  setDropMode(null);
                }}
                onDragStart={(event) => {
                  setDraggedId(row.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", row.id);
                }}
                title="Arrastrá sobre un padre válido para anidar, o sobre un hermano para reordenar"
                type="button"
              >
                <GripVertical size={13} />
              </button>
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
        size: 280,
      }),
      columnHelper.display({
        id: "attrs",
        header: () => <span className="sr-only">Atributos</span>,
        cell: (info) =>
          renderAttrs ? (
            <div className="do-notion-row-attrs">{renderAttrs(info.row.original.item)}</div>
          ) : null,
        size: 220,
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
    [onSelectItem, expanded, renderAttrs],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedParent =
    selectedItemId && byId.has(selectedItemId) ? byId.get(selectedItemId) : null;

  const submitNew = (asChildOfSelected: boolean) => {
    const title = draft.trim();
    if (!title) return;
    const parent =
      asChildOfSelected && selectedParent && allowedChildKinds(hierarchyKind(selectedParent)).length
        ? selectedParent
        : null;
    const kind = parent ? defaultCreateKind(parent) : createKind;
    onAddItem(title, {
      workItemType: kind,
      type: kind,
      itemType: kind,
      ...(parent ? parentLinkPatch(parent) : {}),
    });
    setDraft("");
    setCreateKind(defaultCreateKind(null));
    if (parent) {
      setExpanded((current) => new Set(current).add(String(parent.id)));
    }
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
          {table.getRowModel().rows.map((row) => {
            const id = row.original.id;
            const isDropChild = dropTargetId === id && dropMode === "child";
            const isDropReorder = dropTargetId === id && dropMode === "reorder";
            return (
              <tr
                className={[
                  selectedItemId === id ? "is-selected" : "",
                  draggedId === id ? "is-dragging" : "",
                  isDropChild ? "is-drop-child" : "",
                  isDropReorder ? "is-drop-reorder" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={row.id}
                onDragLeave={() => {
                  setDropTargetId((current) => (current === id ? null : current));
                  setDropMode((current) => (dropTargetId === id ? null : current));
                }}
                onDragOver={(event) => {
                  if (!draggedId || draggedId === id) return;
                  const resolved = resolveDrop(id);
                  if (!resolved) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTargetId(id);
                  setDropMode(resolved.mode);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void applyDrop(id).finally(() => {
                    setDraggedId(null);
                    setDropTargetId(null);
                    setDropMode(null);
                  });
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="do-notion-add-row">
            <td colSpan={8}>
              <form
                className="do-notion-add-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitNew(false);
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
                  onKeyDown={(event) => {
                    if (event.key === "Tab" && !event.shiftKey && draft.trim() && selectedParent) {
                      const allowed = allowedChildKinds(hierarchyKind(selectedParent));
                      if (allowed.length) {
                        event.preventDefault();
                        submitNew(true);
                      }
                    }
                  }}
                  placeholder=""
                  value={draft}
                />
                <span className="do-notion-add-hint">Tab = hijo del seleccionado · Arrastrá para anidar</span>
              </form>
            </td>
          </tr>
        </tbody>
        {estimateSum > 0 ? (
          <tfoot>
            <tr>
              <td colSpan={6} />
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
