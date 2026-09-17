import { useEffect, useMemo, useRef, useState } from "react";
import type { EntityAdapter, SavedView } from "../../lib/views/types";
import { t } from "../../lib/i18n";

function viewSignature(view: SavedView): string {
  return JSON.stringify({
    name: view.name,
    columns: view.columns,
    quickActions: view.quickActions,
    density: view.density,
    showSubtasks: view.showSubtasks,
    filters: view.filters,
    sort: view.sort,
    groupBy: view.groupBy,
  });
}

export function ViewCustomizer<Row>({
  open,
  view,
  adapter,
  onClose,
  onChange,
  onSaveAsTeam,
  onReset,
}: {
  open: boolean;
  view: SavedView;
  adapter: EntityAdapter<Row>;
  onClose(): void;
  onChange(next: SavedView): void;
  onSaveAsTeam(): void;
  onReset(): void;
}) {
  const [draft, setDraft] = useState(view);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setDraft(view);
  }, [view]);

  useEffect(() => {
    if (!open) return;
    if (viewSignature(draft) === viewSignature(view)) return;
    const timer = window.setTimeout(() => onChangeRef.current(draft), 500);
    return () => window.clearTimeout(timer);
  }, [draft, open, view]);

  const visibleIds = useMemo(
    () => new Set(draft.columns.map((col) => col.id)),
    [draft.columns],
  );

  if (!open) return null;

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
    <aside className="cw-views-customizer" data-testid="views-customizer">
      <header>
        <strong>{t("views.customize")}</strong>
        <button onClick={onClose} type="button">
          {t("views.close")}
        </button>
      </header>

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
          {adapter.columns.map((col) => {
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

      <section>
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
      </section>

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

      <footer>
        <button onClick={onSaveAsTeam} type="button">
          {t("views.saveAsTeam")}
        </button>
        <button onClick={onReset} type="button">
          {t("views.reset")}
        </button>
      </footer>
    </aside>
  );
}
