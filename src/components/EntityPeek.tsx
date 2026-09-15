import { useEffect } from "react";
import { LayoutGrid, X } from "./ui/Icon";
import { getLocale, t } from "../lib/i18n";
import "./semanticBlocks.css";

export type EntityPeekModel = {
  id: string;
  kind: "task" | "project" | "note" | "person" | "doc" | "record";
  title: string;
  status?: string | null;
  owner?: string | null;
  dueDate?: string | null;
  excerpt?: string | null;
  /** Record-only */
  tableName?: string | null;
  tableIcon?: string | null;
  previewFields?: Array<{ label: string; value: string }>;
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

  const isRecord = entity.kind === "record";

  return (
    <aside className="cw-entity-peek" data-testid="entity-peek" data-kind={entity.kind}>
      <div className="cw-entity-peek-head">
        <div>
          <em style={{ fontStyle: "normal", fontSize: 11, color: "var(--text-muted)" }}>
            {isRecord ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {entity.tableIcon || <LayoutGrid size={11} />}
                {entity.tableName || t("tables.sidebar")}
              </span>
            ) : (
              entity.kind
            )}
          </em>
          <strong>{entity.title}</strong>
        </div>
        <button aria-label="Close" onClick={onClose} type="button">
          <X size={14} />
        </button>
      </div>
      <div className="cw-entity-peek-meta">
        {entity.status ? (
          <span>
            {isRecord ? `${t("tables.key.status")}: ` : ""}
            {entity.status}
          </span>
        ) : null}
        {entity.owner ? (
          <span>
            {isRecord ? `${t("tables.key.owner")}: ` : ""}
            {entity.owner}
          </span>
        ) : null}
        {entity.dueDate ? (
          <span>
            {isRecord ? `${t("tables.key.date")}: ` : ""}
            {entity.dueDate}
          </span>
        ) : null}
      </div>
      {isRecord && entity.previewFields && entity.previewFields.length > 0 ? (
        <div className="cw-entity-peek-body" data-testid="entity-peek-record-fields">
          {entity.previewFields.slice(0, 3).map((field) => (
            <div key={field.label} style={{ marginBottom: 4 }}>
              <em style={{ fontStyle: "normal", color: "var(--text-muted)", fontSize: 11 }}>
                {field.label}
              </em>
              <div>{field.value || "—"}</div>
            </div>
          ))}
        </div>
      ) : entity.excerpt ? (
        <div className="cw-entity-peek-body">{entity.excerpt}</div>
      ) : null}
      <div className="cw-entity-peek-actions">
        {onOpenSplit && (
          <button onClick={onOpenSplit} type="button">
            {locale === "es" ? "Abrir" : "Open"}
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
