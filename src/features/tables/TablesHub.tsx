import { Archive, RotateCcw, Trash2 } from "../../components/ui/Icon";
import { t } from "../../lib/i18n";
import type { TableDoc } from "../../lib/tables";

export function TablesHub({
  tables,
  archivedTables,
  deletedTables,
  onOpenTable,
  onCreate,
  onRestore,
  onDeleteForever,
  showTrash,
  onToggleTrash,
}: {
  tables: TableDoc[];
  archivedTables: TableDoc[];
  deletedTables: TableDoc[];
  onOpenTable(tableId: string): void;
  onCreate(): void;
  onRestore(table: TableDoc): void;
  onDeleteForever(table: TableDoc): void;
  showTrash: boolean;
  onToggleTrash(): void;
}) {
  return (
    <div className="cw-tables-hub" data-testid="tables-hub">
      <header className="cw-tables-hub-head">
        <div>
          <h1>{t("tables.sidebar")}</h1>
          <p className="cw-tables-muted">{t("tables.hub.empty")}</p>
        </div>
        <button className="cw-tables-btn-primary" onClick={onCreate} type="button">
          + {t("tables.new")}
        </button>
      </header>

      <div className="cw-tables-hub-list">
        {tables.map((table) => (
          <button
            className="cw-tables-hub-row"
            key={table.id}
            onClick={() => onOpenTable(table.id)}
            type="button"
          >
            <span
              aria-hidden
              className="cw-tables-hub-swatch"
              style={{ background: table.color || "var(--accent)" }}
            />
            <span className="cw-dir-row-title">{table.name || t("tables.untitled")}</span>
            <span className="cw-tables-muted">
              {Number(table.recordCount || 0)} · {Number(table.itemCount || 0)}
            </span>
          </button>
        ))}
        {tables.length === 0 ? (
          <p className="cw-tables-muted">{t("tables.empty.tables")}</p>
        ) : null}
      </div>

      <footer className="cw-tables-hub-foot">
        <button
          className="cw-tables-btn-ghost"
          data-testid="tables-trash-toggle"
          onClick={onToggleTrash}
          type="button"
        >
          <Archive size={14} /> {t("tables.trash.link")}
          {archivedTables.length + deletedTables.length > 0
            ? ` (${archivedTables.length + deletedTables.length})`
            : ""}
        </button>
      </footer>

      {showTrash ? (
        <section className="cw-tables-trash" data-testid="tables-trash">
          <h2>{t("tables.trash.title")}</h2>
          {archivedTables.length === 0 && deletedTables.length === 0 ? (
            <p className="cw-tables-muted">{t("tables.trash.empty")}</p>
          ) : (
            <>
              {archivedTables.length > 0 ? (
                <div className="cw-tables-trash-group">
                  <h3>{t("tables.trash.archived")}</h3>
                  {archivedTables.map((table) => (
                    <div className="cw-tables-trash-row" key={table.id}>
                      <span className="cw-dir-row-title">
                        {table.name || t("tables.untitled")}
                      </span>
                      <button
                        className="cw-tables-btn-ghost"
                        onClick={() => onRestore(table)}
                        type="button"
                      >
                        <RotateCcw size={13} /> {t("tables.trash.restore")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {deletedTables.length > 0 ? (
                <div className="cw-tables-trash-group">
                  <h3>{t("tables.trash.deleted")}</h3>
                  {deletedTables.map((table) => (
                    <div className="cw-tables-trash-row" key={table.id}>
                      <span className="cw-dir-row-title">
                        {table.name || t("tables.untitled")}
                      </span>
                      <div className="cw-tables-trash-actions">
                        <button
                          className="cw-tables-btn-ghost"
                          onClick={() => onRestore(table)}
                          type="button"
                        >
                          <RotateCcw size={13} /> {t("tables.trash.restore")}
                        </button>
                        <button
                          className="cw-tables-btn-ghost is-danger"
                          data-testid={`tables-delete-forever-${table.id}`}
                          onClick={() => onDeleteForever(table)}
                          type="button"
                        >
                          <Trash2 size={13} /> {t("tables.trash.deleteForever")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
