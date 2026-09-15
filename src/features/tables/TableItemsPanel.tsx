import { useEffect, useMemo, useState } from "react";
import { Link2, Plus, Search, X } from "../../components/ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import { t } from "../../lib/i18n";
import { entityTitle } from "../../lib/workspaceDisplay";
import {
  linkTableItem,
  listTableItems,
  unlinkTableItem,
} from "../../lib/tables";

export type TableItemCandidate = {
  id: string;
  title: string;
  projectId?: string | null;
  projectTitle?: string;
  status?: string;
};

export type TableItemsPanelProps = {
  tableId: string;
  workspaceId: string;
  candidates: TableItemCandidate[];
  onOpenItem?(itemId: string): void;
  onItemsChanged?(itemIds: string[]): void;
};

type ItemFilter = "all" | "associated" | "general";

export function TableItemsPanel({
  tableId,
  workspaceId,
  candidates,
  onOpenItem,
  onItemsChanged,
}: TableItemsPanelProps) {
  const { user } = useAuth();
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<ItemFilter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const ids = await listTableItems(tableId);
    setLinkedIds(ids);
    onItemsChanged?.(ids);
  };

  useEffect(() => {
    void refresh();
  }, [tableId]);

  const linkedSet = useMemo(() => new Set(linkedIds), [linkedIds]);

  const linkedRows = useMemo(() => {
    return linkedIds
      .map((id) => {
        const hit = candidates.find((row) => row.id === id);
        if (hit) return hit;
        return {
          id,
          title: id,
          projectId: null,
          projectTitle: "",
        } satisfies TableItemCandidate;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [candidates, linkedIds]);

  const pickerHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((row) => !linkedSet.has(row.id))
      .filter((row) => {
        if (filter === "associated") return Boolean(row.projectId);
        if (filter === "general") return !row.projectId;
        return true;
      })
      .filter((row) => {
        if (!q) return true;
        const hay = `${row.title} ${row.projectTitle || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [candidates, filter, linkedSet, query]);

  const addItem = async (itemId: string) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await linkTableItem({
        workspaceId,
        userId: user.uid,
        tableId,
        itemId,
      });
      setMenuOpen(false);
      setQuery("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await unlinkTableItem({ tableId, itemId });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cw-tables-items" data-testid="tables-items-panel">
      <header className="cw-tables-items-head">
        <div>
          <h2>{t("tables.items.title")}</h2>
          <p className="cw-tables-muted">
            {t("tables.items.summary").replace("{n}", String(linkedRows.length))}
          </p>
        </div>
        <div className="cw-tables-link-menu-wrap">
          <button
            type="button"
            className="cw-tables-btn"
            data-testid="tables-items-add"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Plus size={14} /> {t("tables.items.add")}
          </button>
          {menuOpen ? (
            <div className="cw-tables-popover cw-tables-items-picker" data-testid="tables-items-picker">
              <div className="cw-tables-items-filters">
                {(
                  [
                    ["all", t("tables.items.filterAll")],
                    ["associated", t("tables.items.filterAssociated")],
                    ["general", t("tables.items.filterGeneral")],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={filter === id ? "is-active" : ""}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="cw-tables-items-search">
                <Search size={12} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("tables.items.search")}
                />
              </div>
              <ul className="cw-tables-items-picker-list">
                {pickerHits.map((row) => (
                  <li key={row.id}>
                    <button type="button" onClick={() => void addItem(row.id)}>
                      <span>{row.title}</span>
                      <em>
                        {row.projectId
                          ? row.projectTitle || t("tables.items.associated")
                          : t("tables.items.general")}
                      </em>
                    </button>
                  </li>
                ))}
                {!pickerHits.length ? (
                  <li className="cw-tables-muted">{t("tables.items.noMatches")}</li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      </header>

      <ul className="cw-tables-items-list">
        {linkedRows.map((row) => (
          <li key={row.id} data-testid={`tables-item-${row.id}`}>
            <button
              type="button"
              className="cw-tables-items-row"
              onClick={() => onOpenItem?.(row.id)}
            >
              <Link2 size={14} />
              <span className="cw-tables-items-row-main">
                <strong>{row.title || entityTitle(row)}</strong>
                <small>
                  {row.projectId
                    ? `${t("tables.items.associated")} · ${row.projectTitle || row.projectId}`
                    : t("tables.items.general")}
                </small>
              </span>
            </button>
            <button
              type="button"
              className="cw-tables-icon-btn"
              aria-label={t("tables.items.unlink")}
              onClick={() => void removeItem(row.id)}
            >
              <X size={14} />
            </button>
          </li>
        ))}
        {!linkedRows.length ? (
          <li className="cw-tables-muted cw-tables-items-empty">{t("tables.items.empty")}</li>
        ) : null}
      </ul>
    </div>
  );
}
