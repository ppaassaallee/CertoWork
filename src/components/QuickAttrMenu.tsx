import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type QuickAttrMode = "single" | "multi";

export function QuickAttrMenu({
  anchor,
  title,
  mode,
  children,
}: {
  anchor: { top: number; right: number; bottom: number };
  title: string;
  mode: QuickAttrMode;
  children: ReactNode;
}) {
  const [pos, setPos] = useState({ top: anchor.bottom + 6, left: 8 });

  useLayoutEffect(() => {
    const width = 280;
    const estimated = 320;
    let left = anchor.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - anchor.bottom;
    const top = spaceBelow < 220 && anchor.top > spaceBelow
      ? Math.max(8, anchor.top - Math.min(estimated, anchor.top - 8))
      : Math.min(anchor.bottom + 6, window.innerHeight - 48);
    setPos({ top, left });
  }, [anchor.top, anchor.right, anchor.bottom]);

  return createPortal(
    <div
      className="do-quick-attr-menu"
      data-mode={mode}
      data-testid="quick-attr-menu"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      style={{ top: pos.top, left: pos.left }}
    >
      <header>
        <strong>{title}</strong>
        <em>{mode === "multi" ? "Multi-select" : "Single select"}</em>
      </header>
      <div className="do-quick-attr-body">{children}</div>
    </div>,
    document.body,
  );
}

export function QuickAttrChoices({
  options,
  value,
  multi = false,
  onPick,
  onRename,
  empty = "Nothing to choose yet",
  ariaLabel,
}: {
  options: Array<{ id: string; label: string }>;
  value: string | string[];
  multi?: boolean;
  onPick: (id: string) => void;
  onRename?: (id: string, next: string) => void;
  empty?: string;
  ariaLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState("");
  const [draft, setDraft] = useState("");
  const selected = new Set(Array.isArray(value) ? value : value == null ? [] : [String(value)]);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;
  return (
    <div className="do-quick-attr-choices">
      {options.length > 6 && (
        <input
          aria-label="Filter options"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          value={query}
        />
      )}
      <div aria-label={ariaLabel} aria-multiselectable={multi || undefined} className="do-quick-attr-options" role="listbox">
        {visible.length === 0 ? <p>{empty}</p> : null}
        {visible.map((option) => {
          const on = selected.has(option.id);
          if (onRename && editing === option.id) {
            return (
              <form
                className="do-quick-attr-rename"
                key={option.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = draft.trim();
                  if (next && next !== option.label) onRename(option.id, next);
                  setEditing("");
                }}
              >
                <input
                  aria-label={`Rename ${option.label}`}
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  value={draft}
                />
                <button type="submit">Save</button>
              </form>
            );
          }
          return (
            <div className="do-quick-attr-option" key={option.id}>
              <button
                aria-selected={on}
                className={on ? "is-active" : ""}
                onClick={() => onPick(option.id)}
                role="option"
                type="button"
              >
                <span aria-hidden="true">{on ? "✓" : ""}</span>
                {option.label}
              </button>
              {onRename && option.id ? (
                <button
                  aria-label={`Rename ${option.label}`}
                  className="do-quick-attr-edit"
                  onClick={() => {
                    setEditing(option.id);
                    setDraft(option.label);
                  }}
                  type="button"
                >
                  Edit
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function QuickAttrCreate({
  placeholder,
  onCreate,
}: {
  placeholder: string;
  onCreate: (name: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="do-quick-attr-create"
      onSubmit={(event) => {
        event.preventDefault();
        const name = draft.trim();
        if (!name) return;
        onCreate(name);
        setDraft("");
      }}
    >
      <input
        aria-label={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        value={draft}
      />
      <button type="submit">Add</button>
    </form>
  );
}
