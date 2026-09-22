import { useMemo, useState } from "react";
import { Home, Link2, Plus, Search, X } from "../../components/ui/Icon";
import { t } from "../../lib/i18n";
import {
  linkTableToProject,
  relatedProjectIdsOf,
  setTableHomeProject,
  unlinkTableFromProject,
  type TableDoc,
} from "../../lib/tables";

export type TableProjectOption = {
  id: string;
  name: string;
  status?: string;
};

export type TableProjectsBarProps = {
  table: TableDoc;
  projects: TableProjectOption[];
  canEdit?: boolean;
  onOpenProject?(projectId: string): void;
  onTableChange?(next: TableDoc): void;
};

export function TableProjectsBar({
  table,
  projects,
  canEdit = true,
  onOpenProject,
  onTableChange,
}: TableProjectsBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [asHome, setAsHome] = useState(false);

  const homeId = table.projectId ? String(table.projectId) : "";
  const relatedIds = useMemo(() => relatedProjectIdsOf(table), [table]);
  const linkedIds = useMemo(() => {
    const set = new Set(relatedIds);
    if (homeId) set.add(homeId);
    return set;
  }, [homeId, relatedIds]);

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name || id;

  const pickerHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => !linkedIds.has(p.id))
      .filter((p) => {
        if (String(p.status || "").toLowerCase() === "deleted") return false;
        if (!q) return true;
        return String(p.name || "").toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [projects, linkedIds, query]);

  const patchLocal = (next: Partial<TableDoc>) => {
    onTableChange?.({ ...table, ...next });
  };

  const linkOne = async (projectId: string, home: boolean) => {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      await linkTableToProject({
        tableId: table.id,
        projectId,
        asHome: home,
        previousHomeId: table.projectId ?? null,
      });
      if (home) {
        const nextRelated = relatedIds.filter((id) => id !== projectId);
        if (homeId && homeId !== projectId && !nextRelated.includes(homeId)) {
          nextRelated.push(homeId);
        }
        patchLocal({
          projectId,
          relatedProjectIds: nextRelated,
        });
      } else {
        patchLocal({
          relatedProjectIds: Array.from(new Set([...relatedIds, projectId])),
        });
      }
      setMenuOpen(false);
      setQuery("");
      setAsHome(false);
    } finally {
      setBusy(false);
    }
  };

  const unlinkOne = async (projectId: string) => {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      await unlinkTableFromProject({
        tableId: table.id,
        projectId,
        currentHomeId: table.projectId ?? null,
      });
      const clearingHome = homeId === projectId;
      patchLocal({
        projectId: clearingHome ? null : table.projectId,
        relatedProjectIds: relatedIds.filter((id) => id !== projectId),
      });
    } finally {
      setBusy(false);
    }
  };

  const makeHome = async (projectId: string) => {
    if (!canEdit || busy || homeId === projectId) return;
    setBusy(true);
    try {
      await setTableHomeProject({
        tableId: table.id,
        projectId,
        keepPreviousAsRelated: true,
        previousProjectId: table.projectId ?? null,
      });
      const nextRelated = relatedIds.filter((id) => id !== projectId);
      if (homeId && !nextRelated.includes(homeId)) nextRelated.push(homeId);
      patchLocal({ projectId, relatedProjectIds: nextRelated });
    } finally {
      setBusy(false);
    }
  };

  const chips: Array<{ id: string; role: "home" | "related" }> = [];
  if (homeId) chips.push({ id: homeId, role: "home" });
  for (const id of relatedIds) {
    if (id === homeId) continue;
    chips.push({ id, role: "related" });
  }

  return (
    <div className="cw-table-projects" data-testid="table-projects-bar">
      <div className="cw-table-projects-label">
        <Link2 size={13} />
        <span>{t("tables.projectLinks.barLabel")}</span>
      </div>
      <div className="cw-table-projects-chips">
        {chips.map((chip) => (
          <span
            key={`${chip.role}-${chip.id}`}
            className={`cw-table-project-chip is-${chip.role}`}
            data-testid={`table-project-chip-${chip.id}`}
          >
            <button
              type="button"
              className="cw-table-project-chip-main"
              onClick={() => onOpenProject?.(chip.id)}
            >
              {chip.role === "home" ? <Home size={11} /> : null}
              <strong>{projectName(chip.id)}</strong>
              <em>
                {chip.role === "home"
                  ? t("tables.projectLinks.badgeHome")
                  : t("tables.projectLinks.badgeRelated")}
              </em>
            </button>
            {canEdit ? (
              <span className="cw-table-project-chip-actions">
                {chip.role === "related" ? (
                  <button
                    type="button"
                    title={t("tables.projectLinks.makeHome")}
                    onClick={() => void makeHome(chip.id)}
                  >
                    <Home size={11} />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={t("tables.projectLinks.unlink")}
                  onClick={() => void unlinkOne(chip.id)}
                >
                  <X size={11} />
                </button>
              </span>
            ) : null}
          </span>
        ))}
        {!chips.length ? (
          <span className="cw-tables-muted cw-table-projects-empty">
            {t("tables.projectLinks.barEmpty")}
          </span>
        ) : null}
        {canEdit ? (
          <div className="cw-tables-link-menu-wrap">
            <button
              type="button"
              className="cw-tables-chip-btn"
              data-testid="table-projects-link"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Plus size={12} /> {t("tables.projectLinks.link")}
            </button>
            {menuOpen ? (
              <div
                className="cw-tables-popover cw-tables-items-picker"
                data-testid="table-projects-picker"
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
                    placeholder={t("tables.projectLinks.searchProjects")}
                  />
                </div>
                <ul className="cw-tables-items-picker-list">
                  {pickerHits.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => void linkOne(row.id, asHome)}
                      >
                        <span>{row.name}</span>
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
      </div>
    </div>
  );
}
