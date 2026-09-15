import { useMemo, useState } from "react";
import { Plus, X } from "../../components/ui/Icon";
import type {
  Column,
  ColumnType,
  KeyColumns,
  StatusOption,
  TableDoc,
} from "../../lib/tables";
import {
  STATUS_TONES,
  ensureStatusOptionTones,
  nextStatusTone,
  withStatusTone,
} from "../../lib/tables";
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

function defaultStatusSeed(): StatusOption[] {
  return ensureStatusOptionTones([
    { id: "todo", label: t("tables.status.todo"), tone: "neutral" },
    { id: "doing", label: t("tables.status.doing"), tone: "info" },
    { id: "done", label: t("tables.status.done"), tone: "success" },
  ]);
}

export function ColumnsEditor({ table, onClose, onChange }: ColumnsEditorProps) {
  const [columns, setColumns] = useState<Column[]>(() =>
    table.columns.map((col) =>
      col.type === "status"
        ? { ...col, options: ensureStatusOptionTones(col.options || []) }
        : col,
    ),
  );
  const [keys, setKeys] = useState<KeyColumns>(() => ({ ...table.keyColumns }));
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ColumnType>("text");
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});

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
    const normalized = nextCols.map((col) =>
      col.type === "status"
        ? { ...col, options: ensureStatusOptionTones(col.options || []) }
        : col,
    );
    setColumns(normalized);
    setKeys(nextKeys);
    onChange(normalized, nextKeys);
  };

  const updateColumn = (columnId: string, patch: Partial<Column>) => {
    commit(
      columns.map((col) => (col.id === columnId ? { ...col, ...patch } : col)),
      keys,
    );
  };

  const addColumn = () => {
    const name = newName.trim() || t("tables.columns.untitled");
    const col: Column = {
      id: slugId(name),
      name,
      type: newType,
      ...(newType === "status" ? { options: defaultStatusSeed() } : {}),
    };
    commit([...columns, col], keys);
    setNewName("");
    setNewType("text");
  };

  const addStatusOption = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col || col.type !== "status") return;
    const draft = (optionDrafts[columnId] || "").trim();
    const label = draft || t("tables.columns.optionUntitled");
    const existing = col.options || [];
    const option = withStatusTone(
      {
        id: slugId(label),
        label,
      },
      existing,
    );
    updateColumn(columnId, { options: [...existing, option] });
    setOptionDrafts((current) => ({ ...current, [columnId]: "" }));
  };

  const setOptionTone = (
    columnId: string,
    optionId: string,
    tone: StatusOption["tone"],
  ) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col?.options) return;
    updateColumn(columnId, {
      options: col.options.map((opt) =>
        opt.id === optionId ? { ...opt, tone } : opt,
      ),
    });
  };

  const renameOption = (columnId: string, optionId: string, label: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col?.options) return;
    updateColumn(columnId, {
      options: col.options.map((opt) =>
        opt.id === optionId ? { ...opt, label } : opt,
      ),
    });
  };

  const removeOption = (columnId: string, optionId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col?.options) return;
    updateColumn(columnId, {
      options: col.options.filter((opt) => opt.id !== optionId),
    });
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
                  updateColumn(col.id, { name: e.target.value });
                }}
              />
              <span className="cw-tables-col-type">{col.type}</span>
              {col.id === keys.title ? (
                <span className="cw-tables-col-badge">{t("tables.columns.titleKey")}</span>
              ) : (
                <button
                  type="button"
                  className="cw-tables-btn-ghost"
                  data-testid={`tables-remove-col-${col.id}`}
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

            {col.type === "status" ? (
              <div className="cw-tables-status-options" data-testid={`tables-status-options-${col.id}`}>
                <div className="cw-tables-status-options-label">
                  {t("tables.columns.statusOptions")}
                </div>
                <ul className="cw-tables-status-option-list">
                  {(col.options || []).map((opt) => (
                    <li key={opt.id}>
                      <input
                        className="cw-tables-input cw-tables-status-option-label"
                        value={opt.label}
                        aria-label={t("tables.columns.optionLabel")}
                        onChange={(e) => renameOption(col.id, opt.id, e.target.value)}
                      />
                      <div
                        className="cw-tables-tone-swatches"
                        role="group"
                        aria-label={t("tables.columns.optionColor")}
                      >
                        {STATUS_TONES.map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            className={`cw-tables-tone-swatch cw-tables-tone-${tone}${
                              opt.tone === tone ? " is-on" : ""
                            }`}
                            title={tone}
                            aria-label={tone}
                            aria-pressed={opt.tone === tone}
                            data-testid={`tables-tone-${col.id}-${opt.id}-${tone}`}
                            onClick={() => setOptionTone(col.id, opt.id, tone)}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="cw-tables-icon-btn"
                        aria-label={t("tables.columns.removeOption")}
                        onClick={() => removeOption(col.id, opt.id)}
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="cw-tables-status-option-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addStatusOption(col.id);
                  }}
                >
                  <input
                    className="cw-tables-input"
                    placeholder={t("tables.columns.optionPlaceholder")}
                    value={optionDrafts[col.id] || ""}
                    onChange={(e) =>
                      setOptionDrafts((current) => ({
                        ...current,
                        [col.id]: e.target.value,
                      }))
                    }
                  />
                  <button type="submit" className="cw-tables-btn-ghost">
                    <Plus size={12} /> {t("tables.columns.addOption")}
                  </button>
                  <span className="cw-tables-muted cw-tables-tone-hint">
                    {t("tables.columns.autoColorHint").replace(
                      "{tone}",
                      nextStatusTone(col.options || []),
                    )}
                  </span>
                </form>
              </div>
            ) : null}
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
          data-testid="tables-columns-new-name"
        />
        <select
          className="cw-tables-select"
          value={newType}
          onChange={(e) => setNewType(e.target.value as ColumnType)}
          data-testid="tables-columns-new-type"
        >
          {ADDABLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button type="submit" className="cw-tables-btn" data-testid="tables-columns-add">
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
