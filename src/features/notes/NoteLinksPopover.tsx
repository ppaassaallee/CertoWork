import { useEffect, useMemo, useState } from "react";
import { Link2, X } from "../../components/ui/Icon";
import {
  linkNote,
  listNoteLinks,
  unlinkNote,
  type NoteLinkTarget,
} from "../../lib/notes";

export type NoteLinksPopoverProps = {
  workspaceId: string;
  userId: string;
  noteId: string;
  items: Array<{ id: string; title?: string; key?: string; projectTitle?: string }>;
  projects: Array<{ id: string; title?: string; name?: string }>;
  people: Array<{ id: string; displayName?: string; name?: string }>;
  notes: Array<{ id: string; title?: string }>;
  locale: "es" | "en";
  onClose: () => void;
  onCreateItem?: () => void;
};

export function NoteLinksPopover({
  workspaceId,
  userId,
  noteId,
  items,
  projects,
  people,
  notes,
  locale,
  onClose,
  onCreateItem,
}: NoteLinksPopoverProps) {
  const [links, setLinks] = useState<NoteLinkTarget[]>([]);
  const [query, setQuery] = useState("");

  const refresh = async () => {
    setLinks(await listNoteLinks(noteId));
  };

  useEffect(() => {
    void refresh();
  }, [noteId]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: Array<{ target: NoteLinkTarget; title: string; hint?: string }> = [];
    for (const item of items.slice(0, 40)) {
      const title = String(item.key || item.title || item.id);
      if (q && !title.toLowerCase().includes(q)) continue;
      rows.push({
        target: { type: "task", id: item.id },
        title,
        hint: item.projectTitle,
      });
    }
    for (const project of projects.slice(0, 20)) {
      const title = String(project.title || project.name || project.id);
      if (q && !title.toLowerCase().includes(q)) continue;
      rows.push({ target: { type: "project", id: project.id }, title });
    }
    for (const person of people.slice(0, 20)) {
      const title = String(person.displayName || person.name || person.id);
      if (q && !title.toLowerCase().includes(q)) continue;
      rows.push({ target: { type: "person", id: person.id }, title });
    }
    for (const note of notes.slice(0, 20)) {
      if (note.id === noteId) continue;
      const title = String(note.title || note.id);
      if (q && !title.toLowerCase().includes(q)) continue;
      rows.push({ target: { type: "note", id: note.id }, title });
    }
    return rows.slice(0, 12);
  }, [items, projects, people, notes, query, noteId]);

  const labelFor = (target: NoteLinkTarget) => {
    if (target.type === "task") {
      return items.find((i) => i.id === target.id)?.title || target.id;
    }
    if (target.type === "project") {
      return projects.find((p) => p.id === target.id)?.title || target.id;
    }
    if (target.type === "person") {
      return people.find((p) => p.id === target.id)?.displayName || target.id;
    }
    return notes.find((n) => n.id === target.id)?.title || target.id;
  };

  return (
    <div className="cw-notes-popover" data-testid="note-links-popover" style={{ width: 360 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Link2 size={12} />
        <strong style={{ fontSize: 12, flex: 1 }}>
          {locale === "es" ? "Vinculados" : "Linked"}
        </strong>
        <button onClick={onClose} type="button">
          <X size={12} />
        </button>
      </div>
      <input
        onChange={(e) => setQuery(e.target.value)}
        placeholder={locale === "es" ? "Buscar…" : "Search…"}
        style={{ width: "100%", marginBottom: 8, fontSize: 12, padding: 6 }}
        value={query}
      />
      {links.map((link) => (
        <div key={`${link.type}:${link.id}`} style={{ display: "flex", gap: 8, padding: "6px 4px", fontSize: 12 }}>
          <span style={{ flex: 1 }}>{labelFor(link)}</span>
          <button
            onClick={() => void unlinkNote({ noteId, target: link }).then(refresh)}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
      {query ? (
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }}>
          {candidates.map((row) => (
            <button
              key={`${row.target.type}:${row.target.id}`}
              onClick={() =>
                void linkNote({
                  workspaceId,
                  userId,
                  noteId,
                  target: row.target,
                }).then(refresh)
              }
              type="button"
            >
              {row.title}
              {row.hint ? <em style={{ color: "var(--text-muted)" }}> · {row.hint}</em> : null}
            </button>
          ))}
        </div>
      ) : null}
      <button onClick={onCreateItem} style={{ marginTop: 8 }} type="button">
        + {locale === "es" ? "Nuevo ítem desde esta nota" : "New item from this note"}
      </button>
    </div>
  );
}
