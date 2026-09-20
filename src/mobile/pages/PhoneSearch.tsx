import { useMemo, useState } from "react";
import { ArrowLeft, Search } from "../../components/ui/Icon";
import { MIconButton, MListRow, MSegmented } from "../ui";

type Seg = "all" | "items" | "projects" | "notes" | "people";

export function PhoneSearch({
  open,
  onClose,
  items,
  projects,
  notes,
  onOpenItem,
  onOpenProject,
  onOpenNote,
}: {
  open: boolean;
  onClose: () => void;
  items: Array<{ id: string; title: string }>;
  projects: Array<{ id: string; title: string }>;
  notes: Array<{ id: string; title: string }>;
  onOpenItem: (id: string) => void;
  onOpenProject: (id: string) => void;
  onOpenNote: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Seg>("all");
  const needle = q.trim().toLowerCase();

  const results = useMemo(() => {
    const match = (t: string) => !needle || t.toLowerCase().includes(needle);
    const rows: Array<{ id: string; title: string; kind: Seg; open: () => void }> = [];
    if (seg === "all" || seg === "items") {
      for (const i of items) {
        if (match(i.title)) rows.push({ id: i.id, title: i.title, kind: "items", open: () => onOpenItem(i.id) });
      }
    }
    if (seg === "all" || seg === "projects") {
      for (const p of projects) {
        if (match(p.title))
          rows.push({ id: p.id, title: p.title, kind: "projects", open: () => onOpenProject(p.id) });
      }
    }
    if (seg === "all" || seg === "notes") {
      for (const n of notes) {
        if (match(n.title)) rows.push({ id: n.id, title: n.title, kind: "notes", open: () => onOpenNote(n.id) });
      }
    }
    return rows.slice(0, 40);
  }, [items, projects, notes, needle, seg, onOpenItem, onOpenProject, onOpenNote]);

  if (!open) return null;

  return (
    <div
      className="m-root"
      data-testid="phone-search"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "var(--c-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 8px" }}>
        <MIconButton label="Back" onClick={onClose}>
          <ArrowLeft size={20} />
        </MIconButton>
        <div className="m-search-field" style={{ flex: 1, margin: 0 }}>
          <Search size={16} />
          <input
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            value={q}
          />
        </div>
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <MSegmented
          onChange={(id) => setSeg(id as Seg)}
          options={[
            { id: "all", label: "All" },
            { id: "items", label: "Items" },
            { id: "projects", label: "Projects" },
            { id: "notes", label: "Notes" },
            { id: "people", label: "People" },
          ]}
          value={seg}
        />
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {results.map((r) => (
          <MListRow
            key={`${r.kind}-${r.id}`}
            meta={r.kind}
            onClick={() => {
              r.open();
              onClose();
            }}
            title={r.title}
          />
        ))}
        {!results.length ? <p className="m-caption" style={{ padding: 16 }}>No results.</p> : null}
      </div>
    </div>
  );
}
