import { useEffect, useId } from "react";
import { CornerDownRight, Layers, X } from "./ui/Icon";
import { Button } from "./ui/Button";
import { dismissCloseGuard, useCloseGuard } from "../lib/closeGuard";
import { localize } from "../lib/localize";
import { useLocale } from "../lib/useLocale";
import { workItemTypeLabel } from "../lib/workItemTypeLabels";

const VISIBLE_CHILDREN = 6;

export function CloseGuardDialog({
  onOpenItem,
}: {
  onOpenItem?: (id: string) => void;
}) {
  const locale = useLocale();
  const guard = useCloseGuard();
  const titleId = useId();

  useEffect(() => {
    if (!guard) return;
    document.querySelector<HTMLButtonElement>("[data-testid='close-guard-dismiss']")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismissCloseGuard();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [guard]);

  if (!guard) return null;

  const kind = workItemTypeLabel(guard.parentKind, locale);
  const shown = guard.open.slice(0, VISIBLE_CHILDREN);
  const rest = guard.open.length - shown.length;
  const openLabel = localize(
    locale,
    `${guard.open.length} still open`,
    `${guard.open.length} sin terminar`,
  );

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="cw-close-guard"
      data-testid="close-guard-dialog"
      role="dialog"
    >
      <button
        aria-label={localize(locale, "Dismiss", "Cerrar")}
        className="cw-close-guard-scrim"
        onClick={() => dismissCloseGuard()}
        type="button"
      />
      <div className="cw-close-guard-panel">
        <button
          aria-label={localize(locale, "Dismiss", "Cerrar")}
          className="cw-close-guard-x"
          onClick={() => dismissCloseGuard()}
          type="button"
        >
          <X size={16} />
        </button>
        <div className="cw-close-guard-icon" aria-hidden="true">
          <Layers size={18} />
        </div>
        <h2 id={titleId}>
          {localize(locale, "Finish the items inside first", "Termina primero lo de adentro")}
        </h2>
        <p>
          {localize(
            locale,
            `${kind} “${guard.parentTitle}” stays open until everything inside it is done.`,
            `${kind} “${guard.parentTitle}” sigue abierto hasta que todo lo de adentro esté terminado.`,
          )}
        </p>
        <div className="cw-close-guard-count">{openLabel}</div>
        <ul>
          {shown.map((child) => (
            <li key={child.id}>
              <button
                data-testid="close-guard-open-child"
                onClick={() => {
                  dismissCloseGuard();
                  onOpenItem?.(child.id);
                }}
                type="button"
              >
                <CornerDownRight size={14} />
                <span>
                  <b>{child.title === "Untitled" ? localize(locale, "Untitled", "Sin título") : child.title}</b>
                  <small>{workItemTypeLabel(child.kind, locale)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {rest > 0 ? (
          <p className="cw-close-guard-more">
            {localize(locale, `and ${rest} more`, `y ${rest} más`)}
          </p>
        ) : null}
        <div className="cw-close-guard-actions">
          <Button data-testid="close-guard-dismiss" onClick={() => dismissCloseGuard()} variant="primary">
            {localize(locale, "Got it", "Entendido")}
          </Button>
        </div>
      </div>
    </div>
  );
}
