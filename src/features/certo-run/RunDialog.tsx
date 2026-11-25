import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "../../lib/useLocale";
import { runText as t } from "./runCopy";

/** Native top-layer dialog: shared focus, Escape, scroll and return-focus behavior. */
export function RunDialog({ title, onClose, children, kind = "dialog", busy = false }: {
  title: string; onClose: () => void; children: ReactNode; kind?: "dialog" | "drawer" | "command"; busy?: boolean;
}) {
  useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    node.showModal();
    document.documentElement.style.overflow = "hidden";
    const first = node.querySelector<HTMLElement>("[data-initial-focus]");
    first?.focus();
    return () => {
      node.close();
      document.documentElement.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>('.cr-tabs [aria-selected="true"]')?.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className={`cr-run-layer cr-run-${kind}`} aria-labelledby={titleId}
    aria-busy={busy || undefined} onCancel={event => { event.preventDefault(); close.current(); }} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],summary,[tabindex]')].filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <header className="cr-layer-header"><h2 id={titleId}>{title}</h2><button type="button" className="cr-icon-button" aria-label={t("Close")} onClick={onClose}>×</button></header>
    <div className="cr-layer-content">{children}</div>
  </dialog>, document.body);
}

export function RunTabs<T extends string>({ label, value, options, onChange, className = "cr-subtabs", panelId }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; className?: string; panelId?: string;
}) {
  return <div className={className} role="tablist" aria-label={label} onKeyDown={event => {
    const index = options.findIndex(option => option.value === value);
    const next = event.key === "ArrowRight" ? (index + 1) % options.length : event.key === "ArrowLeft" ? (index - 1 + options.length) % options.length : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(options[next].value);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }}>{options.map(option => <button type="button" role="tab" id={panelId ? `${panelId}-tab-${option.value}` : undefined} aria-controls={panelId}
    aria-selected={value === option.value} tabIndex={value === option.value ? 0 : -1} key={option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
