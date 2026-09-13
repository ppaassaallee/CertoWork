import { useEffect } from "react";
import { X } from "./ui/Icon";
import { getLocale } from "../lib/i18n";
import "./semanticBlocks.css";

export type EntityPeekModel = {
  id: string;
  kind: "task" | "project" | "note" | "person" | "doc";
  title: string;
  status?: string | null;
  owner?: string | null;
  dueDate?: string | null;
  excerpt?: string | null;
};

export function EntityPeek({
  entity,
  onClose,
  onOpenSplit,
  onExpand,
}: {
  entity: EntityPeekModel | null;
  onClose: () => void;
  onOpenSplit?: () => void;
  onExpand?: () => void;
}) {
  const locale = getLocale();

  useEffect(() => {
    if (!entity) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entity, onClose]);

  if (!entity) return null;

  return (
    <aside className="cw-entity-peek" data-testid="entity-peek">
      <div className="cw-entity-peek-head">
        <div>
          <em style={{ fontStyle: "normal", fontSize: 11, color: "var(--text-muted)" }}>
            {entity.kind}
          </em>
          <strong>{entity.title}</strong>
        </div>
        <button aria-label="Close" onClick={onClose} type="button">
          <X size={14} />
        </button>
      </div>
      <div className="cw-entity-peek-meta">
        {entity.status && <span>{entity.status}</span>}
        {entity.owner && <span>{entity.owner}</span>}
        {entity.dueDate && <span>{entity.dueDate}</span>}
      </div>
      {entity.excerpt && <div className="cw-entity-peek-body">{entity.excerpt}</div>}
      <div className="cw-entity-peek-actions">
        {onOpenSplit && (
          <button onClick={onOpenSplit} type="button">
            {locale === "es" ? "Abrir en split" : "Open in split"}
          </button>
        )}
        {onExpand && (
          <button onClick={onExpand} type="button">
            {locale === "es" ? "Expandir" : "Expand"}
          </button>
        )}
      </div>
    </aside>
  );
}
