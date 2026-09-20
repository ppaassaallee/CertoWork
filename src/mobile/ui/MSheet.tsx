import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { X } from "../../components/ui/Icon";
import { MIconButton } from "./MIconButton";

export function MSheet({
  open,
  title,
  onClose,
  children,
  footer,
  rightAction,
  snap = 0.9,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  rightAction?: ReactNode;
  snap?: 0.45 | 0.9;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    node?.querySelector<HTMLElement>("button, [href], input, textarea, select")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !footerRef.current) return;
    const footer = footerRef.current;
    const sync = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      footer.style.paddingBottom = `calc(12px + env(safe-area-inset-bottom, 0px) + ${inset}px)`;
    };
    sync();
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="m-sheet-root" role="presentation">
      <button aria-label="Dismiss" className="m-sheet-scrim" onClick={onClose} type="button" />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`m-sheet is-snap-${snap === 0.45 ? "half" : "full"}`}
        ref={panelRef}
        role="dialog"
      >
        <div className="m-sheet-handle" />
        <header className="m-sheet-head">
          <h2 id={titleId}>{title}</h2>
          {rightAction}
          <MIconButton label="Close" onClick={onClose}>
            <X size={20} />
          </MIconButton>
        </header>
        <div className="m-sheet-body">{children}</div>
        {footer ? (
          <div className="m-sheet-footer" ref={footerRef}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
