export type ViewType =
  | "list"
  | "board"
  | "table"
  | "calendar"
  | "timeline"
  | "chart"
  | "overview"
  | "feed";

export type ViewScope = "items" | "invoices" | "projects";

export type ViewDefinition = {
  id: string;
  ownerUid: string | null;
  scope: ViewScope;
  type: ViewType;
  name: string;
  filters?: Record<string, unknown>;
  sort?: string;
  groupBy?: string;
  columns?: string[];
  createdAt?: unknown;
};

const CATALOG: Record<
  ViewScope,
  Array<{ type: ViewType; name: string; description: string; popular?: boolean }>
> = {
  items: [
    { type: "list", name: "List", description: "Grouped rows with status", popular: true },
    { type: "board", name: "Board", description: "Kanban by status", popular: true },
    { type: "table", name: "Table", description: "Spreadsheet columns", popular: true },
    { type: "calendar", name: "Calendar", description: "Due dates on a month", popular: true },
    { type: "timeline", name: "Timeline", description: "Gantt-style schedule" },
    { type: "overview", name: "Overview", description: "Summary cards" },
  ],
  invoices: [
    { type: "list", name: "List", description: "Invoice table", popular: true },
    { type: "board", name: "Board", description: "Status columns", popular: true },
    { type: "calendar", name: "Calendar", description: "Due dates", popular: true },
    { type: "chart", name: "Chart", description: "Billed vs collected", popular: true },
  ],
  projects: [
    { type: "list", name: "List", description: "Project rows", popular: true },
    { type: "board", name: "Board", description: "Stage columns", popular: true },
    { type: "table", name: "Table", description: "Dense columns" },
    { type: "overview", name: "Overview", description: "Gallery cards" },
  ],
};

export function AddViewPopover({
  scope,
  onSelect,
  onClose,
}: {
  scope: ViewScope;
  onSelect: (type: ViewType, name: string) => void;
  onClose: () => void;
}) {
  const items = CATALOG[scope] || [];
  const popular = items.filter((i) => i.popular);
  const other = items.filter((i) => !i.popular);
  return (
    <div className="d-popover add-view-pop" role="dialog" aria-label="Add a new view">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Add a new view</strong>
        <button onClick={onClose} type="button" aria-label="Close">
          ✕
        </button>
      </div>
      <input
        aria-label="Search views"
        placeholder="Search views…"
        style={{
          width: "100%",
          margin: "10px 0",
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid var(--c-line)",
        }}
      />
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--c-ink-2)" }}>
        Popular views
      </p>
      <div className="add-view-grid">
        {popular.map((p) => (
          <button key={p.type} className="add-view-tile" onClick={() => onSelect(p.type, p.name)} type="button">
            <span className="tile-icon">{p.type[0].toUpperCase()}</span>
            <span>
              <strong>{p.name}</strong>
              <br />
              <span className="sub">{p.description}</span>
            </span>
          </button>
        ))}
      </div>
      {other.length ? (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--c-ink-2)", marginTop: 12 }}>
            Other views
          </p>
          <div className="add-view-grid">
            {other.map((p) => (
              <button key={p.type} className="add-view-tile" onClick={() => onSelect(p.type, p.name)} type="button">
                <span className="tile-icon">{p.type[0].toUpperCase()}</span>
                <span>
                  <strong>{p.name}</strong>
                  <br />
                  <span className="sub">{p.description}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
