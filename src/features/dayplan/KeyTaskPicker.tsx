import { useEffect, useRef, useState } from "react";
import { CheckSquare, Bookmark, AlertTriangle, Flag } from "../../components/ui/Icon";

export type KeyTaskPickerItem = {
  id: string;
  title: string;
  type?: string;
  projectTitle?: string;
};

export type KeyTaskPickerProps = {
  open: boolean;
  items: KeyTaskPickerItem[];
  hasKey: boolean;
  locale: "es" | "en";
  onPick: (itemId: string | null) => void;
  onClose: () => void;
};

function TypeGlyph({ type }: { type?: string }) {
  const lower = String(type || "").toLowerCase();
  if (lower.includes("epic") || lower.includes("épica")) return <Bookmark size={12} />;
  if (lower.includes("bug")) return <AlertTriangle size={12} />;
  if (lower.includes("milestone") || lower.includes("hito")) return <Flag size={12} />;
  return <CheckSquare size={12} />;
}

export function KeyTaskPicker({
  open,
  items,
  hasKey,
  locale,
  onPick,
  onClose,
}: KeyTaskPickerProps) {
  const list = items.slice(0, 12);
  const rows: Array<{ id: string | null; title: string; projectTitle?: string; type?: string }> = [
    ...(hasKey
      ? [{ id: null as string | null, title: locale === "es" ? "Ninguna" : "None" }]
      : []),
    ...list.map((item) => ({
      id: item.id as string | null,
      title: item.title,
      projectTitle: item.projectTitle,
      type: item.type,
    })),
  ];
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => Math.min(rows.length - 1, i + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const row = rows[active];
        if (row) onPick(row.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, active, rows.length, onClose, onPick]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cw-dayplan-picker" data-testid="key-task-picker" ref={rootRef} role="listbox">
      {rows.map((row, index) => (
        <button
          className={`cw-dayplan-picker-row ${index === active ? "is-active" : ""}`}
          key={row.id ?? "none"}
          onClick={() => onPick(row.id)}
          onMouseEnter={() => setActive(index)}
          role="option"
          type="button"
        >
          {row.id ? <TypeGlyph type={row.type} /> : null}
          <span>
            <strong>{row.title}</strong>
            {row.projectTitle ? <em>{row.projectTitle}</em> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
