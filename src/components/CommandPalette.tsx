import { useEffect, useMemo, useState } from "react";
import { Folder, Home, Search, ShieldCheck, Sparkles } from "./ui/Icon";

export type CommandPaletteItem = {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  onSelect: () => void;
};

export function CommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();
    const needle = normalize(query.trim());
    if (!needle) return items.slice(0, 40);
    return items
      .filter((item) =>
        normalize(`${item.label} ${item.group} ${item.keywords || ""}`).includes(needle),
      )
      .slice(0, 60);
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="do-cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
      <button
        aria-label="Close command palette"
        className="do-cmdk-scrim"
        onClick={onClose}
        type="button"
      />
      <div className="do-cmdk-panel">
        <label className="do-cmdk-search">
          <Search size={16} />
          <input
            autoFocus
            aria-label="Search commands"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter" && filtered[active]) {
                event.preventDefault();
                filtered[active].onSelect();
                onClose();
              }
            }}
            placeholder="Search projects, tabs, actions…"
            value={query}
          />
        </label>
        <ul className="do-cmdk-list">
          {filtered.map((item, index) => (
            <li key={item.id}>
              <button
                className={index === active ? "is-active" : ""}
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
                onMouseEnter={() => setActive(index)}
                type="button"
              >
                <span>{item.label}</span>
                <small>{item.group}</small>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="do-cmdk-empty">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export function commandIcons() {
  return { Folder, Home, ShieldCheck, Sparkles };
}
