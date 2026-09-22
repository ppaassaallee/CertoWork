import { useMemo, useState } from "react";
import { FolderKanban, Home, Link2, Plus, Search, X } from "../../components/ui/Icon";
import { t } from "../../lib/i18n";
import {
  linkTableToProject,
  listProjectTables,
  unlinkTableFromProject,
  type TableDoc,
} from "../../lib/tables";

export type ProjectTableCandidate = {
  id: string;
  name: string;
  icon?: string;
  projectId?: string | null;
  relatedProjectIds?: string[];
};

export type ProjectTablesPanelProps = {
  projectId: string;
  tables: TableDoc[];
  /** All workspace tables available to link (may include already linked). */
  candidates?: ProjectTableCandidate[];
  canEdit?: boolean;
  onOpenTable?(tableId: string): void;
  onCreateTable?(): void;
  onChanged?(): void;
};

export function ProjectTablesPanel({
  projectId,
  tables,
  candidates = [],
  canEdit = true,
  onOpenTable,
  onCreateTable,
  onChanged,
}: ProjectTablesPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [asHome, setAsHome] = useState(false);

  const linked = useMemo(
    () => listProjectTables(tables, projectId),
    [tables, projectId],
  );
  const linkedIds = useMemo(
    () => new Set(linked.map((row) => row.table.id)),
    [linked],
  );

  const pickerHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((row) => !linkedIds.has(row.id))
      .filter((row) => {
        if (!q) return true;
        return String(row.name || "").toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [candidates, linkedIds, query]);

  const linkOne = async (tableId: string, home: boolean) => {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      const current = tables.find((row) => row.id === tableId);
      await linkTableToProject({
        tableId,
        projectId,
        asHome: home,
        previousHomeId: current?.projectId ?? null,
      });
      setMenuOpen(false);
      setQuery("");
      setAsHome(false);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const unlinkOne = async (table: TableDoc) => {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      await unlinkTableFromProject({
        tableId: table.id,
        projectId,
        currentHomeId: table.projectId ?? null,
      });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const promoteHome = async (table: TableDoc) => {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      await linkTableToProject({
        tableId: table.id,
        projectId,
        asHome: true,
        previousHomeId: table.projectId ?? null,
      });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cw-project-tables" data-testid="project-tables-panel">
      <header className="cw-project-tables-head">
        <div>
          <h2>{t("tables.projectLinks.title")}</h2>
          <p className="cw-tables-muted">
            {t("tables.projectLinks.summary").replace(
              "{n}",
              String(linked.length),
            )}
          </p>
        </div>
        {canEdit ? (
          <div className="cw-tables-link-menu-wrap">
            {onCreateTable ? (
              <button
                type="button"
                className="cw-tables-chip-btn"
                data-testid="project-tables-create"
                onClick={onCreateTable}
              >
                <Plus size={14} /> {t("tables.projectLinks.create")}
              </button>
            ) : null}
            <button
              type="button"
              className="cw-tables-btn"
              data-testid="project-tables-link"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Link2 size={14} /> {t("tables.projectLinks.link")}
            </button>
            {menuOpen ? (
              <div
                className="cw-tables-popover cw-tables-items-picker"
                data-testid="project-tables-picker"
              >
                <div className="cw-tables-items-filters">
                  <button
                    type="button"
                    className={!asHome ? "is-active" : ""}
                    onClick={() => setAsHome(false)}
                  >
                    {t("tables.projectLinks.asRelated")}
                  </button>
                  <button
                    type="button"
                    className={asHome ? "is-active" : ""}
                    onClick={() => setAsHome(true)}
                  >
                    {t("tables.projectLinks.asHome")}
                  </button>
                </div>
                <div className="cw-tables-items-search">
                  <Search size={12} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("tables.projectLinks.search")}
                  />
                </div>
                <ul className="cw-tables-items-picker-list">
                  {pickerHits.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => void linkOne(row.id, asHome)}
                      >
                        <span>
                          {row.icon ? `${row.icon} ` : ""}
                          {row.name}
                        </span>
                        <em>
                          {asHome
                            ? t("tables.projectLinks.roleHome")
                            : t("tables.projectLinks.roleRelated")}
                        </em>
                      </button>
                    </li>
                  ))}
                  {!pickerHits.length ? (
                    <li className="cw-tables-muted">
                      {t("tables.projectLinks.noMatches")}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <ul className="cw-project-tables-list">
        {linked.map(({ table, role }) => (
          <li key={table.id} data-testid={`project-table-${table.id}`}>
            <button
              type="button"
              className="cw-project-tables-row"
              onClick={() => onOpenTable?.(table.id)}
            >
              <span className="cw-project-tables-icon" aria-hidden>
                {table.icon || "▦"}
              </span>
              <span className="cw-project-tables-row-main">
                <strong>{table.name}</strong>
                <small>
                  {role === "home" ? (
                    <>
                      <Home size={11} /> {t("tables.projectLinks.roleHome")}
                    </>
                  ) : (
                    <>
                      <FolderKanban size={11} />{" "}
                      {t("tables.projectLinks.roleRelated")}
                    </>
                  )}
                  {" · "}
                  {t("tables.meta.records").replace(
                    "{n}",
                    String(table.recordCount || 0),
                  )}
                </small>
              </span>
              <span
                className={`cw-project-tables-badge is-${role}`}
                aria-hidden
              >
                {role === "home"
                  ? t("tables.projectLinks.badgeHome")
                  : t("tables.projectLinks.badgeRelated")}
              </span>
            </button>
            {canEdit ? (
              <div className="cw-project-tables-actions">
                {role !== "home" ? (
                  <button
                    type="button"
                    className="cw-tables-chip-btn"
                    title={t("tables.projectLinks.makeHome")}
                    onClick={() => void promoteHome(table)}
                  >
                    <Home size={12} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="cw-tables-icon-btn"
                  aria-label={t("tables.projectLinks.unlink")}
                  onClick={() => void unlinkOne(table)}
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
          </li>
        ))}
        {!linked.length ? (
          <li className="cw-tables-muted cw-project-tables-empty">
            {t("tables.projectLinks.empty")}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
