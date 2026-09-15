import { useMemo, useState } from "react";
import { Filter, X } from "../../components/ui/Icon";
import type { TableDoc } from "../../lib/tables";
import {
  emptyTableFilters,
  tableFiltersActive,
  type TableFilterState,
} from "../../lib/tables";
import type { TableMember } from "./cells/RecordCells";
import { t } from "../../lib/i18n";

export function TableFiltersBar({
  table,
  members,
  filters,
  onChange,
  open,
  onOpenChange,
}: {
  table: TableDoc;
  members: TableMember[];
  filters: TableFilterState;
  onChange(next: TableFilterState): void;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const statusCol = useMemo(
    () => table.columns.find((col) => col.id === table.keyColumns.status),
    [table],
  );
  const active = tableFiltersActive(filters);
  const [draftQuery, setDraftQuery] = useState(filters.query);

  return (
    <div className="cw-tables-filters" data-testid="tables-filters">
      <button
        type="button"
        className={`cw-tables-chip-btn${active || open ? " is-active" : ""}`}
        data-testid="tables-filter-toggle"
        onClick={() => onOpenChange(!open)}
      >
        <Filter size={14} />
        {t("tables.page.filter")}
        {active ? <span className="cw-tables-filter-dot" /> : null}
      </button>
      {open ? (
        <div className="cw-tables-filters-panel" data-testid="tables-filters-panel">
          <div className="cw-tables-filters-row">
            <input
              className="cw-tables-input"
              placeholder={t("tables.filters.search")}
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              onBlur={() => onChange({ ...filters, query: draftQuery })}
              onKeyDown={(e) => {
                if (e.key === "Enter") onChange({ ...filters, query: draftQuery });
              }}
            />
            <button
              type="button"
              className="cw-tables-btn-ghost"
              onClick={() => {
                setDraftQuery("");
                onChange(emptyTableFilters());
              }}
            >
              {t("tables.filters.clear")}
            </button>
            <button
              type="button"
              className="cw-tables-icon-btn"
              aria-label={t("tables.panel.close")}
              onClick={() => onOpenChange(false)}
            >
              <X size={14} />
            </button>
          </div>
          {statusCol?.options?.length ? (
            <div className="cw-tables-filters-group">
              <span>{t("tables.key.status")}</span>
              <div className="cw-tables-filters-chips">
                {statusCol.options.map((opt) => {
                  const on = filters.statusIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`cw-tables-filter-chip cw-tables-tone-${opt.tone}${on ? " is-on" : ""}`}
                      onClick={() => {
                        const statusIds = on
                          ? filters.statusIds.filter((id) => id !== opt.id)
                          : [...filters.statusIds, opt.id];
                        onChange({ ...filters, statusIds });
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {table.keyColumns.owner ? (
            <div className="cw-tables-filters-group">
              <span>{t("tables.key.owner")}</span>
              <select
                className="cw-tables-select"
                value={filters.ownerIds[0] || ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    ownerIds: e.target.value ? [e.target.value] : [],
                  })
                }
              >
                <option value="">{t("tables.filters.anyOwner")}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email || member.id}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {table.keyColumns.date ? (
            <div className="cw-tables-filters-group cw-tables-filters-dates">
              <span>{t("tables.key.date")}</span>
              <input
                className="cw-tables-input"
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) =>
                  onChange({ ...filters, dateFrom: e.target.value || null })
                }
              />
              <input
                className="cw-tables-input"
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) =>
                  onChange({ ...filters, dateTo: e.target.value || null })
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
