import { useMemo, useState } from "react";
import { Plus, X } from "../../components/ui/Icon";
import type { Column, ColumnType, KeyColumns, TableDoc } from "../../lib/tables";
import { t } from "../../lib/i18n";

export type ColumnsEditorProps = {
  table: TableDoc;
  onClose(): void;
  onChange(columns: Column[], keyColumns: KeyColumns): void;
};

const ADDABLE_TYPES: ColumnType[] = [
  "text",
  "longtext",
  "number",
  "currency",
  "date",
  "status",
  "person",
  "tags",
  "checkbox",
  "url",
  "email",
  "phone",
  "file",
  "relation",
];

function slugId(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return `${base || "col"}_${Math.random().toString(36).slice(2, 6)}`;
}

export function ColumnsEditor({ table, onClose, onChange }: ColumnsEditorProps) {
  const [columns, setColumns] = useState<Column[]>(() => [...table.columns]);
  const [keys, setKeys] = useState<KeyColumns>(() => ({ ...table.keyColumns }));
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ColumnType>("text");

  const statusCandidates = useMemo(
    () => columns.filter((c) => c.type === "status"),
    [columns],
  );
  const personCandidates = useMemo(
    () => columns.filter((c) => c.type === "person"),
    [columns],
  );
  const dateCandidates = useMemo(
    () => columns.filter((c) => c.type === "date"),
    [columns],
  );

  const commit = (nextCols: Column[], nextKeys: KeyColumns) => {
    setColumns(nextCols);
    setKeys(nextKeys);
    onChange(nextCols, nextKeys);
  };

  const addColumn = () => {
    const name = newName.trim() || t("tables.columns.untitled");
    const col: Column = {
      id: slugId(name),
      name,
      type: newType,
      ...(newType === "status"
        ? {
            options: [
              { id: "todo", label: t("tables.status.todo"), tone: "neutral" as const },
              { id: "doing", label: t("tables.status.doing"), tone: "info" as const },
              { id: "done", label: t("tables.status.done"), tone: "success" as const },
            ],
          }
        : {}),
    };
    commit([...columns, col], keys);
    setNewName("");
    setNewType("text");
  };

  return (
    <aside className="cw-tables-columns" data-testid="tables-columns-editor">
      <header className="cw-tables-columns-head">
        <div>
          <strong>{t("tables.columns.title")}</strong>
          <p className="cw-tables-muted">{t("tables.columns.subtitle")}</p>
        </div>
        <button type="button" className="cw-tables-icon-btn" aria-label={t("tables.panel.close")} onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      <ul className="cw-tables-columns-list">
        {columns.map((col) => (
          <li key={col.id} className={col.hidden ? "is-hidden" : ""}>
            <div className="cw-tables-columns-row">
              <input
                className="cw-tables-input"
                value={col.name}
                disabled={col.id === keys.title}
                onChange={(e) => {
                  const next = columns.map((c) =>
                    c.id === col.id ? { ...c, name: e.target.value } : c,
                  );
                  commit(next, keys);
                }}
              />
              <span className="cw-tables-col-type">{col.type}</span>
              {col.id === keys.title ? (
                <span className="cw-tables-col-badge">{t("tables.columns.titleKey")}</span>
              ) : (
                <button
                  type="button"
                  className="cw-tables-btn-ghost"
                  onClick={() => {
                    const next = columns.filter((c) => c.id !== col.id);
                    const nextKeys: KeyColumns = { ...keys };
                    if (keys.status === col.id) nextKeys.status = null;
                    if (keys.owner === col.id) nextKeys.owner = null;
                    if (keys.date === col.id) nextKeys.date = null;
                    commit(next, nextKeys);
                  }}
                >
                  {t("tables.columns.remove")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form
        className="cw-tables-columns-add"
        onSubmit={(e) => {
          e.preventDefault();
          addColumn();
        }}
      >
        <input
          className="cw-tables-input"
          placeholder={t("tables.columns.namePlaceholder")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          className="cw-tables-select"
          value={newType}
          onChange={(e) => setNewType(e.target.value as ColumnType)}
        >
          {ADDABLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button type="submit" className="cw-tables-btn">
          <Plus size={14} /> {t("tables.columns.add")}
        </button>
      </form>

      <section className="cw-tables-key-map">
        <h3>{t("tables.columns.keysTitle")}</h3>
        <p className="cw-tables-muted">{t("tables.columns.keysHelp")}</p>

        <label className="cw-tables-key-field">
          <span>{t("tables.key.status")}</span>
          <select
            className="cw-tables-select"
            value={keys.status || ""}
            onChange={(e) => commit(columns, { ...keys, status: e.target.value || null })}
          >
            <option value="">{t("tables.columns.none")}</option>
            {statusCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <small>{t("tables.columns.statusHelp")}</small>
        </label>

        <label className="cw-tables-key-field">
          <span>{t("tables.key.owner")}</span>
          <select
            className="cw-tables-select"
            value={keys.owner || ""}
            onChange={(e) => commit(columns, { ...keys, owner: e.target.value || null })}
          >
            <option value="">{t("tables.columns.none")}</option>
            {personCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <small>{t("tables.columns.ownerHelp")}</small>
        </label>

        <label className="cw-tables-key-field">
          <span>{t("tables.key.date")}</span>
          <select
            className="cw-tables-select"
            value={keys.date || ""}
            onChange={(e) => commit(columns, { ...keys, date: e.target.value || null })}
          >
            <option value="">{t("tables.columns.none")}</option>
            {dateCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <small>{t("tables.columns.dateHelp")}</small>
        </label>
      </section>
    </aside>
  );
}
