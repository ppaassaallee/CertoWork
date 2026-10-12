import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "./ui/Icon";

/**
 * One overflow control. Archive and delete are named inside the menu and confirmed
 * before they run. The resting row does not show a trash icon.
 */
export function DestructiveOverflow({
  name,
  onArchive,
  onDelete,
  confirmDelete = true,
}: {
  name: string;
  onArchive?: () => void;
  onDelete?: () => void;
  /** Project delete already opens its own dialog. */
  confirmDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const confirm = (verb: "Archive" | "Delete", action?: () => void) => {
    setOpen(false);
    if (!action) return;
    const detail =
      verb === "Delete"
        ? `Move “${name}” to Deleted? You can undo for 10 seconds, and restore it for 30 days.`
        : `Archive “${name}”? You can undo for 10 seconds.`;
    if (verb === "Delete" && !confirmDelete) {
      action();
      return;
    }
    if (window.confirm(detail)) action();
  };

  return (
    <span
      className="cw-overflow"
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`More actions for ${name}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={14} />
      </button>
      {open ? (
        <span className="cw-overflow-menu" role="menu">
          {onArchive ? (
            <button role="menuitem" type="button" onClick={() => confirm("Archive", onArchive)}>
              Archive
            </button>
          ) : null}
          {onDelete ? (
            <button
              className="is-danger"
              role="menuitem"
              type="button"
              onClick={() => confirm("Delete", onDelete)}
            >
              Delete
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
