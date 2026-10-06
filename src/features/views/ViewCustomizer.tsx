import { useEffect, useMemo, useState } from "react";
import type { EntityAdapter, FilterRule, SavedView } from "../../lib/views/types";
import { t } from "../../lib/i18n";

export type CustomizerSection = "filter" | "sort" | "group" | "customize";

const valueFreeOps: FilterRule["op"][] = ["empty", "notEmpty", "me", "overdue", "today", "week"];

function filterOps(type: string): FilterRule["op"][] {
  if (type === "date") return ["today", "overdue", "week", "before", "after", "empty", "notEmpty"];
  if (type === "person") return ["me", "eq", "ne", "empty", "notEmpty"];
  if (type === "text" || type === "tags") return ["contains", "eq", "ne", "empty", "notEmpty"];
  return ["eq", "ne", "empty", "notEmpty"];
}

export function ViewCustomizer<Row>({
  open,
  view,
  adapter,
  onClose,
  onChange,
  onSaveAsTeam,
  onReset,
  section = "customize",
  columnIds,
  customizeColumnIds,
  showQuickActions = true,
}: {
  open: boolean;
  view: SavedView;
  adapter: EntityAdapter<Row>;
  onClose(): void;
  onChange(next: SavedView): void;
  onSaveAsTeam(next: SavedView): void;
  onReset(): void;
  section?: CustomizerSection;
  columnIds?: string[];
  customizeColumnIds?: string[];
  showQuickActions?: boolean;
}) {
  const [draft, setDraft] = useState(view);
  const availableColumns = useMemo(
    () => adapter.columns.filter((column) => !columnIds || columnIds.includes(column.id)),
    [adapter.columns, columnIds],
  );
  const filterColumns = availableColumns.filter((column) => column.filterable);
  const sortColumns = availableColumns.filter((column) => column.sortable);
  const groupColumns = availableColumns.filter((column) => column.groupable);
  const displayColumns = availableColumns.filter((column) => !customizeColumnIds || customizeColumnIds.includes(column.id));
  const [filterColumnId, setFilterColumnId] = useState("");
  const [filterOp, setFilterOp] = useState<FilterRule["op"]>("contains");
  const [filterValue, setFilterValue] = useState("");

  useEffect(() => {
    if (open) setDraft(view);
  }, [open, view.id]);

  const visibleIds = useMemo(
    () => new Set(draft.columns.map((col) => col.id)),
    [draft.columns],
  );

  if (!open) return null;

  const selectedFilterColumn = filterColumns.find((column) => column.id === filterColumnId) || filterColumns[0];
  const selectedFilterOp = filterOps(selectedFilterColumn?.type || "text").includes(filterOp)
    ? filterOp
    : filterOps(selectedFilterColumn?.type || "text")[0];
  const addFilter = () => {
    if (!selectedFilterColumn || (!valueFreeOps.includes(selectedFilterOp) && !filterValue.trim())) return;
    setDraft((current) => ({
      ...current,
      filters: [...current.filters, {
        columnId: selectedFilterColumn.id,
        op: selectedFilterOp,
        ...(!valueFreeOps.includes(selectedFilterOp) ? { value: filterValue.trim() } : {}),
      }],
    }));
    setFilterValue("");
  };

  const toggleColumn = (id: string, fixed?: boolean) => {
    if (fixed) return;
    if (visibleIds.has(id)) {
      setDraft((current) => ({
        ...current,
        columns: current.columns.filter((col) => col.id !== id),
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      columns: [...current.columns, { id }],
    }));
  };

  const moveColumn = (id: string, dir: -1 | 1) => {
    setDraft((current) => {
      const ids = current.columns.map((col) => col.id);
      const index = ids.indexOf(id);
      const nextIndex = index + dir;
      if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return current;
      const next = [...current.columns];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return { ...current, columns: next };
    });
  };

  const toggleAction = (id: string) => {
    setDraft((current) => {
      const has = current.quickActions.includes(id);
      if (has) {
        return {
          ...current,
          quickActions: current.quickActions.filter((entry) => entry !== id),
        };
      }
      if (current.quickActions.length >= 4) return current;
      return { ...current, quickActions: [...current.quickActions, id] };
    });
  };

  const moveAction = (id: string, dir: -1 | 1) => {
    setDraft((current) => {
      const index = current.quickActions.indexOf(id);
      const nextIndex = index + dir;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.quickActions.length) {
        return current;
      }
      const next = [...current.quickActions];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return { ...current, quickActions: next };
    });
  };

  return (
    <aside aria-label={t(`views.${section}`)} className="cw-views-customizer" data-testid="views-customizer">
      <header>
        <strong>{t(`views.${section}`)}</strong>
        <button onClick={onClose} type="button">
          {t("views.close")}
        </button>
      </header>

      {section === "filter" ? (
        <section className="cw-views-editor-section">
          <h3>{t("views.filter")}</h3>
          {draft.filters.map((rule, index) => (
            <div className="cw-views-rule" key={`${rule.columnId}-${index}`}>
              <span>{availableColumns.find((column) => column.id === rule.columnId)?.label || rule.columnId} · {t(`views.op.${rule.op}`)}{rule.value == null ? "" : ` · ${String(rule.value)}`}</span>
              <button aria-label={`${t("views.removeFilter")} ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, filters: current.filters.filter((_, i) => i !== index) }))} type="button">×</button>
            </div>
          ))}
          {filterColumns.length > 0 && (
            <>
              <label className="cw-views-field"><span>{t("views.field")}</span><select aria-label={t("views.field")} onChange={(event) => { setFilterColumnId(event.target.value); setFilterOp("eq"); setFilterValue(""); }} value={selectedFilterColumn?.id || ""}>{filterColumns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label>
              <label className="cw-views-field"><span>{t("views.condition")}</span><select aria-label={t("views.condition")} onChange={(event) => setFilterOp(event.target.value as FilterRule["op"])} value={selectedFilterOp}>{filterOps(selectedFilterColumn?.type || "text").map((op) => <option key={op} value={op}>{t(`views.op.${op}`)}</option>)}</select></label>
              {!valueFreeOps.includes(selectedFilterOp) && <label className="cw-views-field"><span>{t("views.value")}</span>{selectedFilterColumn?.options ? <select aria-label={t("views.value")} onChange={(event) => setFilterValue(event.target.value)} value={filterValue}><option value="">{t("views.chooseValue")}</option>{selectedFilterColumn.options().map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <input aria-label={t("views.value")} onChange={(event) => setFilterValue(event.target.value)} type={selectedFilterColumn?.type === "date" ? "date" : "text"} value={filterValue} />}</label>}
              <button className="cw-views-add-rule" onClick={addFilter} type="button">+ {t("views.addFilter")}</button>
            </>
          )}
        </section>
      ) : null}

      {section === "sort" ? (
        <section className="cw-views-editor-section">
          <h3>{t("views.sort")}</h3>
          <label className="cw-views-field"><span>{t("views.field")}</span><select aria-label={t("views.sortField")} onChange={(event) => setDraft((current) => ({ ...current, sort: event.target.value ? [{ columnId: event.target.value, dir: current.sort[0]?.dir || "asc" }] : [] }))} value={draft.sort[0]?.columnId || ""}><option value="">{t("views.manualOrder")}</option>{sortColumns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label>
          {draft.sort.length > 0 && <label className="cw-views-field"><span>{t("views.direction")}</span><select aria-label={t("views.direction")} onChange={(event) => setDraft((current) => ({ ...current, sort: current.sort.map((rule, index) => index === 0 ? { ...rule, dir: event.target.value as "asc" | "desc" } : rule) }))} value={draft.sort[0].dir}><option value="asc">{t("views.ascending")}</option><option value="desc">{t("views.descending")}</option></select></label>}
        </section>
      ) : null}

      {section === "group" ? (
        <section className="cw-views-editor-section">
          <h3>{t("views.group")}</h3>
          <label className="cw-views-field"><span>{t("views.field")}</span><select aria-label={t("views.groupField")} onChange={(event) => setDraft((current) => ({ ...current, groupBy: event.target.value || null }))} value={draft.groupBy || ""}><option value="">{t("views.noGrouping")}</option>{groupColumns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label>
        </section>
      ) : null}

      {section === "customize" ? <>

      <label className="cw-views-field">
        <span>{t("views.name")}</span>
        <input
          onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
          value={draft.name}
        />
      </label>

      <section>
        <h3>{t("views.columns")}</h3>
        <ul>
          {displayColumns.map((col) => {
            const visible = visibleIds.has(col.id);
            return (
              <li key={col.id}>
                <label>
                  <input
                    checked={visible}
                    disabled={Boolean(col.fixed)}
                    onChange={() => toggleColumn(col.id, col.fixed)}
                    type="checkbox"
                  />
                  {col.label}
                </label>
                {visible && !col.fixed ? (
                  <span className="cw-views-move">
                    <button onClick={() => moveColumn(col.id, -1)} type="button">
                      ↑
                    </button>
                    <button onClick={() => moveColumn(col.id, 1)} type="button">
                      ↓
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {showQuickActions ? <section>
        <h3>
          {t("views.quickActions")}{" "}
          <em>
            {draft.quickActions.length}/4
          </em>
        </h3>
        <ul>
          {adapter.actions.map((action) => {
            const on = draft.quickActions.includes(action.id);
            return (
              <li key={action.id}>
                <label>
                  <input
                    checked={on}
                    onChange={() => toggleAction(action.id)}
                    type="checkbox"
                  />
                  {action.label}
                </label>
                {on ? (
                  <span className="cw-views-move">
                    <button onClick={() => moveAction(action.id, -1)} type="button">
                      ↑
                    </button>
                    <button onClick={() => moveAction(action.id, 1)} type="button">
                      ↓
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section> : null}

      <label className="cw-views-field">
        <span>{t("views.density")}</span>
        <select
          onChange={(e) =>
            setDraft((current) => ({
              ...current,
              density: e.target.value as SavedView["density"],
            }))
          }
          value={draft.density}
        >
          <option value="comfortable">{t("views.density.comfortable")}</option>
          <option value="compact">{t("views.density.compact")}</option>
        </select>
      </label>

      {adapter.parentId ? (
        <label className="cw-views-check">
          <input
            checked={Boolean(draft.showSubtasks)}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                showSubtasks: e.target.checked,
              }))
            }
            type="checkbox"
          />
          {t("views.showSubtasks")}
        </label>
      ) : null}
      </> : null}

      <footer>
        {section === "customize" && <button onClick={() => { onSaveAsTeam(draft); onClose(); }} type="button">
          {t("views.saveAsTeam")}
        </button>}
        <button onClick={() => { onChange(draft); onClose(); }} type="button">{t("views.apply")}</button>
        <button onClick={onReset} type="button">
          {t("views.reset")}
        </button>
      </footer>
    </aside>
  );
}
