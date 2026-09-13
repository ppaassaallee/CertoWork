import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FileText,
  Folder,
  Hash,
  Home,
  Search,
  ShieldCheck,
  Sparkles,
  User,
} from "./ui/Icon";
import { Kbd } from "./ui/Kbd";
import { EmptyState } from "./ui/EmptyState";

export type CommandPaletteMode = "all" | "actions" | "items" | "people" | "docs";

export type CommandPaletteItem = {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  /** Optional subtitle (e.g. project name) */
  hint?: string;
  icon?: ReactNode;
  mode?: CommandPaletteMode;
  onSelect: () => void;
};

export type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  scopeLabel?: string;
  onCreateItem?: (query: string) => void;
  onCreateProject?: (query: string) => void;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function detectMode(raw: string): { mode: CommandPaletteMode; needle: string; hint: string } {
  const trimmed = raw.trim();
  if (trimmed.startsWith(">")) {
    return { mode: "actions", needle: trimmed.slice(1).trim(), hint: ">" };
  }
  if (trimmed.startsWith("#")) {
    return { mode: "items", needle: trimmed.slice(1).trim(), hint: "#" };
  }
  if (trimmed.startsWith("@")) {
    return { mode: "people", needle: trimmed.slice(1).trim(), hint: "@" };
  }
  if (trimmed.startsWith("/")) {
    return { mode: "docs", needle: trimmed.slice(1).trim(), hint: "/" };
  }
  return { mode: "all", needle: trimmed, hint: "" };
}

function modeIcon(mode: CommandPaletteMode) {
  switch (mode) {
    case "actions":
      return <Sparkles size={14} />;
    case "items":
      return <Hash size={14} />;
    case "people":
      return <User size={14} />;
    case "docs":
      return <FileText size={14} />;
    default:
      return <Search size={14} />;
  }
}

export function CommandPalette({
  open,
  onClose,
  items,
  scopeLabel,
  onCreateItem,
  onCreateProject,
}: CommandPaletteProps) {
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

  const { mode, needle, hint } = useMemo(() => detectMode(query), [query]);

  const filtered = useMemo(() => {
    const pool =
      mode === "all"
        ? items
        : items.filter((item) => !item.mode || item.mode === mode || item.mode === "all");
    if (!needle) return pool.slice(0, 40);
    const n = normalize(needle);
    return pool
      .filter((item) =>
        normalize(`${item.label} ${item.group} ${item.keywords || ""} ${item.hint || ""}`).includes(
          n,
        ),
      )
      .slice(0, 60);
  }, [items, mode, needle]);

  const createActions = useMemo(() => {
    if (filtered.length > 0 || !needle) return [];
    const actions: CommandPaletteItem[] = [];
    if ((mode === "items" || mode === "all") && onCreateItem) {
      actions.push({
        id: "create-item-from-query",
        label: `Create item “${needle}”`,
        group: "Create",
        icon: <Hash size={14} />,
        onSelect: () => onCreateItem(needle),
      });
    }
    if ((mode === "all" || mode === "docs") && onCreateProject) {
      actions.push({
        id: "create-project-from-query",
        label: `Create project “${needle}”`,
        group: "Create",
        icon: <Folder size={14} />,
        onSelect: () => onCreateProject(needle),
      });
    }
    return actions;
  }, [filtered.length, needle, mode, onCreateItem, onCreateProject]);

  const rows = filtered.length > 0 ? filtered : createActions;

  if (!open) return null;

  const runActive = () => {
    const item = rows[active];
    if (!item) return;
    item.onSelect();
    onClose();
  };

  return (
    <div className="do-cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
      <button
        aria-label="Close command palette"
        className="do-cmdk-scrim"
        onClick={onClose}
        type="button"
      />
      <div className="do-cmdk-panel">
        {scopeLabel && (
          <div className="do-cmdk-scope">
            <span className="cw-chip">{scopeLabel}</span>
            {hint && (
              <span className="do-cmdk-mode-hint" title="Prefix mode">
                {modeIcon(mode)} {hint}
              </span>
            )}
          </div>
        )}
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
                setActive((value) => Math.min(value + 1, Math.max(rows.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                runActive();
              }
            }}
            placeholder="Search · > actions · # items · @ people · / docs"
            value={query}
          />
        </label>
        <ul className="do-cmdk-list">
          {rows.map((item, index) => (
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
                <span className="do-cmdk-row-main">
                  <span className="do-cmdk-row-icon" aria-hidden="true">
                    {item.icon || modeIcon(item.mode || "all")}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    {item.hint && <em className="do-cmdk-row-hint">{item.hint}</em>}
                  </span>
                </span>
                <small>{item.group}</small>
              </button>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="do-cmdk-empty">
              <EmptyState
                message="Try another search, or use > # @ / prefixes."
                schematic="tasks"
                title="No matches"
              />
            </li>
          )}
        </ul>
        <footer className="do-cmdk-footer">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> Navigate
          </span>
          <span>
            <Kbd>↵</Kbd> Apply
          </span>
          <span>
            <Kbd>esc</Kbd> Cancel
          </span>
        </footer>
      </div>
    </div>
  );
}

export function commandIcons() {
  return { Folder, Home, ShieldCheck, Sparkles };
}
