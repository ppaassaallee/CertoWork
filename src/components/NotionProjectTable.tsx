import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Plus } from "./ui/Icon";
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
import { type SprintRecord } from "../lib/sprints";
import { taskWorkLane } from "../lib/projectPortfolio";

type NotionRow = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  statusTone: ReturnType<typeof notionStatusTone>;
  start: string;
  end: string;
  progress: number;
  estimate: number;
  difficulty: ReturnType<typeof notionDifficulty>;
  sprintLabel: string;
};

const columnHelper = createColumnHelper<NotionRow>();

function itemTitle(item: any) {
  return String(item?.title || item?.name || item?.summary || "Untitled").trim();
}

function sprintLabelFor(item: any, sprints: SprintRecord[]) {
  const sprintId = String(item?.sprintId || "").trim();
  if (!sprintId) return "";
  const match = sprints.find((sprint) => sprint.id === sprintId);
  const name = String(match?.name || item?.sprint || "").trim();
  const num = name.match(/\d+/);
  return num?.[0] || name.slice(0, 6) || "";
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
  const rows = useMemo<NotionRow[]>(() => {
    return tasks.map((item) => {
      const status = taskWorkLane(item);
      const progress = checklistProgress(checklistItems(item)).percent;
      return {
        id: String(item.id),
        title: itemTitle(item),
        status,
        statusLabel: notionStatusLabel(status),
        statusTone: notionStatusTone(status),
        start: notionShortDate(notionStartDate(item)),
        end: notionShortDate(notionEndDate(item)),
        progress,
        estimate: notionEstimateHours(item),
        difficulty: notionDifficulty(item.priority || item.priorityLevel),
        sprintLabel: sprintLabelFor(item, sprints),
      };
    });
  }, [tasks, sprints]);

  const estimateSum = useMemo(
    () => rows.reduce((sum, row) => sum + row.estimate, 0),
    [rows],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("sprintLabel", {
        header: "Sprint",
        cell: (info) => <span className="do-notion-muted">{info.getValue() || ""}</span>,
        size: 56,
      }),
      columnHelper.accessor("title", {
        header: "Nombre",
        cell: (info) => (
          <button
            className="do-notion-title-cell"
            onClick={() => onSelectItem(info.row.original.id)}
            type="button"
          >
            {info.getValue()}
          </button>
        ),
        size: 220,
      }),
      columnHelper.accessor("statusLabel", {
        header: "Estado",
        cell: (info) => (
          <span className={`do-notion-chip is-${info.row.original.statusTone}`}>
            {info.getValue()}
          </span>
        ),
        size: 110,
      }),
      columnHelper.accessor("start", {
        header: "Inicio",
        cell: (info) => <span className="do-notion-muted">{info.getValue()}</span>,
        size: 72,
      }),
      columnHelper.accessor("end", {
        header: "Fin",
        cell: (info) => <span className="do-notion-muted">{info.getValue()}</span>,
        size: 72,
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
        size: 96,
      }),
      columnHelper.accessor("estimate", {
        header: "ET",
        cell: (info) => (
          <span className="do-notion-muted">{info.getValue() || ""}</span>
        ),
        size: 44,
      }),
      columnHelper.accessor((row) => row.difficulty.label, {
        id: "difficulty",
        header: "Dificultad",
        cell: (info) => (
          <span className={`do-notion-chip is-${info.row.original.difficulty.tone}`}>
            {info.row.original.difficulty.label}
          </span>
        ),
        size: 88,
      }),
    ],
    [onSelectItem],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
            <td />
            <td colSpan={7}>
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
                  aria-label="Nueva"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Nueva"
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
                <em>SUM</em> {estimateSum || ""}
              </span>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      {rows.length === 0 && (
        <p className="do-notion-empty">Todavía no hay ítems. Escribí el primero en Nueva.</p>
      )}
    </div>
  );
}
