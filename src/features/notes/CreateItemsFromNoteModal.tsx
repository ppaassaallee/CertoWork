import { useEffect, useState } from "react";
import { X } from "../../components/ui/Icon";
import type { ProposedNoteItem } from "../../lib/notes/proposeItems";

export type CreateItemsFromNoteModalProps = {
  open: boolean;
  locale: "es" | "en";
  items: ProposedNoteItem[];
  onClose: () => void;
  onConfirm: (items: ProposedNoteItem[]) => void | Promise<void>;
};

export function CreateItemsFromNoteModal({
  open,
  locale,
  items: initial,
  onClose,
  onConfirm,
}: CreateItemsFromNoteModalProps) {
  const [rows, setRows] = useState<ProposedNoteItem[]>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows(initial);
  }, [initial, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  const selected = rows.filter((row) => row.selected);
  const submit = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      await onConfirm(selected);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cw-notes-modal-backdrop" data-testid="create-items-from-note">
      <div className="cw-notes-modal" style={{ width: 560, maxWidth: "92vw" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ flex: 1, fontSize: 14 }}>
            {locale === "es" ? "Crear ítems desde la nota" : "Create items from note"}
          </strong>
          <button onClick={onClose} type="button">
            <X size={14} />
          </button>
        </header>
        <div style={{ maxHeight: 360, overflow: "auto", marginTop: 12 }}>
          {rows.map((row, index) => (
            <label
              key={`${row.sourceLine}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "20px 72px 1fr",
                gap: 8,
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid var(--border)",
                fontSize: 12,
              }}
            >
              <input
                checked={row.selected}
                onChange={(e) =>
                  setRows((cur) =>
                    cur.map((item, i) =>
                      i === index ? { ...item, selected: e.target.checked } : item,
                    ),
                  )
                }
                type="checkbox"
              />
              <select
                onChange={(e) =>
                  setRows((cur) =>
                    cur.map((item, i) =>
                      i === index
                        ? { ...item, type: e.target.value as ProposedNoteItem["type"] }
                        : item,
                    ),
                  )
                }
                value={row.type}
              >
                <option value="pbi">PBI</option>
                <option value="task">Task</option>
                <option value="subtask">Subtask</option>
                <option value="bug">Bug</option>
              </select>
              <input
                onChange={(e) =>
                  setRows((cur) =>
                    cur.map((item, i) =>
                      i === index ? { ...item, title: e.target.value } : item,
                    ),
                  )
                }
                value={row.title}
              />
            </label>
          ))}
          {!rows.length ? (
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
              {locale === "es"
                ? "No se encontraron líneas para convertir."
                : "No lines found to convert."}
            </p>
          ) : null}
        </div>
        <footer style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, gap: 8 }}>
          <button onClick={onClose} type="button">
            {locale === "es" ? "Cancelar" : "Cancel"}
          </button>
          <button
            disabled={!selected.length || busy}
            onClick={() => void submit()}
            type="button"
          >
            {locale === "es"
              ? `Crear ${selected.length} ítems ⌘↵`
              : `Create ${selected.length} items ⌘↵`}
          </button>
        </footer>
      </div>
    </div>
  );
}
