import { useMemo, useState } from "react";
import type { RecordDoc, RecordValue, TableDoc } from "../../lib/tables";
import { t } from "../../lib/i18n";
import type { TableMember } from "./cells/RecordCells";

export type RecordsBoardProps = {
  table: TableDoc;
  records: RecordDoc[];
  members: TableMember[];
  onFieldChange(recordId: string, columnId: string, value: RecordValue): void;
  onOpenRecord(id: string): void;
  onCreateRecord?(statusId?: string): void;
};

export function RecordsBoard({
  table,
  records,
  members,
  onFieldChange,
  onOpenRecord,
  onCreateRecord,
}: RecordsBoardProps) {
  const statusColId = table.keyColumns.status;
  const titleColId = table.keyColumns.title;
  const ownerColId = table.keyColumns.owner;
  const dateColId = table.keyColumns.date;
  const statusCol = table.columns.find((c) => c.id === statusColId);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const columns = useMemo(() => {
    const opts = statusCol?.options || [];
    if (!statusColId || !opts.length) {
      return [{ id: "__all__", label: t("tables.board.all"), tone: "neutral" as const }];
    }
    return [
      ...opts.map((o) => ({ id: o.id, label: o.label, tone: o.tone })),
      { id: "__none__", label: t("tables.status.empty"), tone: "neutral" as const },
    ];
  }, [statusCol, statusColId]);

  const byColumn = useMemo(() => {
    const map = new Map<string, RecordDoc[]>();
    for (const col of columns) map.set(col.id, []);
    for (const record of records) {
      const raw = statusColId ? String(record.values[statusColId] ?? "") : "";
      const key = !statusColId ? "__all__" : raw || "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(record);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return map;
  }, [records, columns, statusColId]);

  if (!statusColId) {
    return <div className="cw-tables-empty">{t("tables.board.needStatus")}</div>;
  }

  return (
    <div className="cw-tables-board" data-testid="tables-board">
      {columns.map((col) => {
        const cards = byColumn.get(col.id) || [];
        return (
          <section
            key={col.id}
            className={`cw-tables-board-col ${overCol === col.id ? "is-over" : ""}`}
            onDragOver={(e) => {
              if (!draggingId || col.id === "__all__") return;
              e.preventDefault();
              setOverCol(col.id);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/record-id") || draggingId;
              setDraggingId(null);
              setOverCol(null);
              if (!id || col.id === "__all__") return;
              const next = col.id === "__none__" ? null : col.id;
              onFieldChange(id, statusColId, next);
            }}
          >
            <header className="cw-tables-board-head">
              <span className={`cw-tables-status-chip cw-tables-tone-${col.tone}`}>{col.label}</span>
              <span className="cw-tables-muted">{cards.length}</span>
            </header>
            <div className="cw-tables-board-cards">
              {cards.map((record) => {
                const title = String(record.values[titleColId] ?? "") || t("tables.untitled");
                const ownerId = ownerColId ? String(record.values[ownerColId] ?? "") : "";
                const owner = members.find((m) => m.id === ownerId);
                const date = dateColId ? String(record.values[dateColId] ?? "").slice(0, 10) : "";
                return (
                  <article
                    key={record.id}
                    className={`cw-tables-board-card ${draggingId === record.id ? "is-dragging" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(record.id);
                      e.dataTransfer.setData("text/record-id", record.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverCol(null);
                    }}
                    onClick={() => onOpenRecord(record.id)}
                  >
                    <strong className="cw-tables-board-title">{title}</strong>
                    <div className="cw-tables-board-meta">
                      {owner ? <span className="cw-tables-person-chip">{owner.name || owner.email}</span> : null}
                      {date ? <span className="cw-tables-date-chip">{date}</span> : null}
                    </div>
                  </article>
                );
              })}
              {onCreateRecord ? (
                <button
                  type="button"
                  className="cw-tables-board-add"
                  onClick={() => onCreateRecord(col.id === "__none__" ? undefined : col.id)}
                >
                  + {t("tables.grid.newRow")}
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
