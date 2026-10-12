import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "./ui/Icon";

/** One menu instead of always-armed archive and delete icons. */
export function ProjectRowMenu({
  name,
  onArchive,
  onDelete,
}: {
  name: string;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);
  return (
    <span className="do-project-actions do-mobile-advanced is-quiet" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={`Actions for ${name}`}
        className="do-project-icon"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <MoreHorizontal size={14} />
      </button>
      {open ? (
        <span className="do-row-menu" role="menu">
          <button role="menuitem" type="button" onClick={() => { setOpen(false); onArchive(); }}>Archive</button>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); onDelete(); }}>Delete</button>
        </span>
      ) : null}
    </span>
  );
}
