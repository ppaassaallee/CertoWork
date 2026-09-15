import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, Search } from "../../../components/ui/Icon";
import { useAuth } from "../../../lib/AuthContext";
import { getLocale } from "../../../lib/i18n";
import {
  linkRecord,
  listRecordsLinkedTo,
  type RecordDoc,
  type TableDoc,
} from "../../../lib/tables";
import { copy } from "./labels";

export function ItemRecordsSection({
  item,
  tables = [],
  records = [],
  onOpenRecord,
}: {
  item: any;
  tables?: TableDoc[];
  records?: RecordDoc[];
  onOpenRecord?: (tableId: string, recordId: string) => void;
}) {
  const { user, workspace } = useAuth();
  const locale = getLocale() === "es" ? "es" : "en";
  const [linked, setLinked] = useState<Array<{ recordId: string; tableId: string }>>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = async () => {
    if (!workspace?.id || !item?.id) return;
    setLinked(await listRecordsLinkedTo(workspace.id, { type: "task", id: String(item.id) }));
  };

  useEffect(() => {
    void refresh();
  }, [item?.id, workspace?.id]);

  const tableById = useMemo(
    () => new Map(tables.map((table) => [table.id, table] as const)),
    [tables],
  );
  const recordById = useMemo(
    () => new Map(records.map((record) => [record.id, record] as const)),
    [records],
  );

  const rows = linked
    .map((link) => {
      const table = tableById.get(link.tableId);
      const record = recordById.get(link.recordId);
      if (!table || !record) {
        return {
          ...link,
          title: link.recordId,
          tableName: link.tableId,
          tableIcon: "▦",
        };
      }
      return {
        ...link,
        title: String(record.values[table.keyColumns.title] ?? "").trim() || table.name,
        tableName: table.name,
        tableIcon: table.icon || "▦",
      };
    })
    .slice(0, 8);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !menuOpen) return [];
    return records
      .map((record) => {
        const table = tableById.get(record.tableId);
        if (!table) return null;
        const title = String(record.values[table.keyColumns.title] ?? "").trim() || table.name;
        const hay = `${title} ${table.name}`.toLowerCase();
        if (!hay.includes(q)) return null;
        return { record, table, title };
      })
      .filter(Boolean)
      .slice(0, 8) as Array<{ record: RecordDoc; table: TableDoc; title: string }>;
  }, [menuOpen, query, records, tableById]);

  const linkExisting = async (tableId: string, recordId: string) => {
    if (!user || !workspace) return;
    setMenuOpen(false);
    setQuery("");
    await linkRecord({
      workspaceId: workspace.id,
      userId: user.uid,
      tableId,
      recordId,
      target: { type: "task", id: String(item.id) },
    });
    await refresh();
  };

  return (
    <section className="cw-item-card" data-testid="item-records">
      <header>
        <strong>
          <LayoutGrid size={12} style={{ marginRight: 6 }} />
          {copy("records", locale)} {rows.length || ""}
        </strong>
        <div style={{ position: "relative" }}>
          <button
            aria-label={locale === "es" ? "Registro" : "Record"}
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
          >
            <Plus size={12} /> {locale === "es" ? "Registro" : "Record"}
          </button>
          {menuOpen ? (
            <div className="cw-notes-popover" style={{ right: 0, minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px" }}>
                <Search size={12} />
                <input
                  autoFocus
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={locale === "es" ? "Buscar registro…" : "Search record…"}
                  style={{
                    flex: 1,
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    fontSize: 12,
                  }}
                  value={query}
                />
              </div>
              {searchHits.map((hit) => (
                <button
                  key={hit.record.id}
                  onClick={() => void linkExisting(hit.table.id, hit.record.id)}
                  type="button"
                >
                  <LayoutGrid size={12} /> {hit.title}
                  <em style={{ color: "var(--text-muted)", marginLeft: 6 }}>{hit.table.name}</em>
                </button>
              ))}
              {query && !searchHits.length ? (
                <span style={{ display: "block", padding: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  {locale === "es" ? "Sin resultados" : "No matches"}
                </span>
              ) : null}
              {!query ? (
                <span style={{ display: "block", padding: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  {locale === "es" ? "Escribí para buscar" : "Type to search"}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      {rows.map((row) => (
        <article key={`${row.tableId}-${row.recordId}`}>
          <button
            onClick={() => onOpenRecord?.(row.tableId, row.recordId)}
            style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
            type="button"
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 11 }}>
              <LayoutGrid size={11} /> {row.tableName}
            </span>
            <p style={{ fontWeight: 500, margin: "2px 0" }}>{row.title}</p>
          </button>
        </article>
      ))}
      {!rows.length ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
          {locale === "es" ? "Sin registros vinculados" : "No linked records"}
        </p>
      ) : null}
    </section>
  );
}
