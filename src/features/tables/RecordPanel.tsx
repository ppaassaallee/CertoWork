import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link2, Plus, X } from "../../components/ui/Icon";
import type {
  Column,
  RecordActivity,
  RecordDoc,
  RecordLinkTarget,
  RecordValue,
  TableDoc,
} from "../../lib/tables";
import { listRecordLinks, unlinkRecord } from "../../lib/tables";
import { useAuth } from "../../lib/AuthContext";
import { t } from "../../lib/i18n";
import { CellRenderer, type TableMember } from "./cells/RecordCells";
import { RecordDrawerNav } from "./RecordDrawerNav";

export type RecordPanelProps = {
  table: TableDoc;
  record: RecordDoc;
  members: TableMember[];
  projects?: Array<{ id: string; name: string }>;
  activity?: RecordActivity[];
  recordOrder?: string[];
  onClose(): void;
  onFieldChange(columnId: string, value: RecordValue): void;
  onComment?(text: string): void;
  onLinkTask?(): void;
  onLinkNote?(): void;
  onLinkTicket?(): void;
  onLinkRecord?(): void;
  onOpenLink?(target: RecordLinkTarget): void;
  onOpenRecord?(id: string): void;
  onOpenProject?(projectId: string): void;
  onAskOdysseus?(): void;
};

function QuickChip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="cw-tables-quick-chip">
      <span className="cw-tables-quick-label">{label}</span>
      <div className="cw-tables-quick-value">{children}</div>
    </div>
  );
}

function linkLabel(target: RecordLinkTarget) {
  if (target.type === "task") return t("tables.panel.linkTask");
  if (target.type === "note") return t("tables.panel.linkNote");
  if (target.type === "ticket") return t("tables.panel.linkTicket");
  if (target.type === "record") return t("tables.panel.linkRecord");
  if (target.type === "invoice") return "Invoice";
  if (target.type === "item") return "Item";
  if (target.type === "project") return "Project";
  return target.type;
}

export function RecordPanel({
  table,
  record,
  members,
  projects = [],
  activity = [],
  recordOrder = [],
  onClose,
  onFieldChange,
  onComment,
  onLinkTask,
  onLinkNote,
  onLinkTicket,
  onLinkRecord,
  onOpenLink,
  onOpenRecord,
  onOpenProject,
  onAskOdysseus,
}: RecordPanelProps) {
  const { user } = useAuth();
  const titleColId = table.keyColumns.title;
  const statusCol = table.columns.find((c) => c.id === table.keyColumns.status);
  const ownerCol = table.columns.find((c) => c.id === table.keyColumns.owner);
  const dateCol = table.columns.find((c) => c.id === table.keyColumns.date);
  const title = String(record.values[titleColId] ?? "");
  const [draftTitle, setDraftTitle] = useState(title);
  const [comment, setComment] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [links, setLinks] = useState<RecordLinkTarget[]>([]);

  useEffect(() => setDraftTitle(title), [title, record.id]);

  useEffect(() => {
    let cancelled = false;
    void listRecordLinks(record.id).then((rows) => {
      if (!cancelled) setLinks(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [record.id, record.linkCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fields = useMemo(
    () =>
      table.columns.filter(
        (c) =>
          !c.hidden &&
          c.id !== titleColId &&
          c.id !== statusCol?.id &&
          c.id !== ownerCol?.id &&
          c.id !== dateCol?.id,
      ),
    [table.columns, titleColId, statusCol?.id, ownerCol?.id, dateCol?.id],
  );

  const renderField = (column: Column | undefined) => {
    if (!column) return null;
    return (
      <CellRenderer
        column={column}
        value={record.values[column.id] ?? null}
        members={members}
        projects={projects}
        onOpenProject={onOpenProject}
        onChange={(next) => onFieldChange(column.id, next)}
      />
    );
  };

  const handleUnlink = async (target: RecordLinkTarget) => {
    if (!user) return;
    await unlinkRecord({
      workspaceId: table.workspaceId,
      userId: user.uid,
      recordId: record.id,
      tableId: table.id,
      target,
    });
    setLinks((current) =>
      current.filter((row) => !(row.type === target.type && row.id === target.id)),
    );
  };

  return (
    <aside className="cw-tables-panel" data-testid="tables-record-panel" role="dialog" aria-modal="true">
      <header className="cw-tables-panel-head">
        <input
          className="cw-tables-panel-title"
          value={draftTitle}
          aria-label={t("tables.panel.title")}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={() => {
            if (draftTitle.trim() !== title) onFieldChange(titleColId, draftTitle.trim() || null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder={t("tables.untitled")}
        />
        <RecordDrawerNav
          canPrev={recordOrder.indexOf(record.id) > 0}
          canNext={recordOrder.indexOf(record.id) >= 0 && recordOrder.indexOf(record.id) < recordOrder.length - 1}
          onPrev={() => {
            const i = recordOrder.indexOf(record.id);
            if (i > 0) onOpenRecord?.(recordOrder[i - 1]);
          }}
          onNext={() => {
            const i = recordOrder.indexOf(record.id);
            if (i >= 0 && i < recordOrder.length - 1) onOpenRecord?.(recordOrder[i + 1]);
          }}
          fullPageHref={`/tables/${encodeURIComponent(table.id)}/records/${encodeURIComponent(record.id)}`}
          onAskOdysseus={onAskOdysseus}
        />
        <button type="button" className="cw-tables-icon-btn" aria-label={t("tables.panel.close")} onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      <div className="cw-tables-panel-quick">
        {statusCol ? (
          <QuickChip label={t("tables.key.status")}>{renderField(statusCol)}</QuickChip>
        ) : null}
        {ownerCol ? (
          <QuickChip label={t("tables.key.owner")}>{renderField(ownerCol)}</QuickChip>
        ) : null}
        {dateCol ? (
          <QuickChip label={t("tables.key.date")}>{renderField(dateCol)}</QuickChip>
        ) : null}
      </div>

      <section className="cw-tables-panel-section">
        <h3>{t("tables.panel.fields")}</h3>
        <ul className="cw-tables-panel-fields">
          {fields.map((column) => (
            <li key={column.id}>
              <span className="cw-tables-field-name">{column.name}</span>
              <div className="cw-tables-field-value">{renderField(column)}</div>
            </li>
          ))}
          {!fields.length ? <li className="cw-tables-muted">{t("tables.panel.noExtraFields")}</li> : null}
        </ul>
      </section>

      <section className="cw-tables-panel-section">
        <div className="cw-tables-panel-section-head">
          <h3>
            <Link2 size={14} /> {t("tables.panel.linked")}
          </h3>
          <div className="cw-tables-link-menu-wrap">
            <button
              type="button"
              className="cw-tables-btn-ghost"
              onClick={() => setLinkOpen((v) => !v)}
            >
              <Plus size={14} /> {t("tables.panel.link")}
            </button>
            {linkOpen ? (
              <div className="cw-tables-popover cw-tables-link-menu">
                <button type="button" onClick={() => { onLinkTask?.(); setLinkOpen(false); }}>
                  {t("tables.panel.linkTask")}
                </button>
                <button type="button" onClick={() => { onLinkNote?.(); setLinkOpen(false); }}>
                  {t("tables.panel.linkNote")}
                </button>
                <button type="button" onClick={() => { onLinkTicket?.(); setLinkOpen(false); }}>
                  {t("tables.panel.linkTicket")}
                </button>
                <button type="button" onClick={() => { onLinkRecord?.(); setLinkOpen(false); }}>
                  {t("tables.panel.linkRecord")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {links.length ? (
          <ul className="cw-tables-panel-links" data-testid="tables-record-links">
            {links.map((link) => (
              <li key={`${link.type}:${link.id}`}>
                <button
                  type="button"
                  className="cw-tables-panel-link"
                  onClick={() => onOpenLink?.(link)}
                >
                  <span>{linkLabel(link)}</span>
                  <em>{link.id}</em>
                </button>
                <button
                  type="button"
                  className="cw-tables-icon-btn"
                  aria-label={t("tables.panel.unlink")}
                  onClick={() => void handleUnlink(link)}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cw-tables-muted cw-tables-panel-stub">{t("tables.panel.linkedEmpty")}</p>
        )}
      </section>

      <section className="cw-tables-panel-section cw-tables-panel-activity">
        <h3>{t("tables.panel.activity")}</h3>
        <ul className="cw-tables-activity-list">
          {activity.length ? (
            activity.map((item) => (
              <li key={item.id}>
                <span className="cw-tables-activity-kind">{item.kind}</span>
                {item.text ? <span>{item.text}</span> : null}
                {item.columnId ? (
                  <span className="cw-tables-muted">
                    {item.columnId}: {String(item.from ?? "∅")} → {String(item.to ?? "∅")}
                  </span>
                ) : null}
                <time className="cw-tables-muted">{new Date(item.createdAt).toLocaleString()}</time>
              </li>
            ))
          ) : (
            <li className="cw-tables-muted">{t("tables.panel.noActivity")}</li>
          )}
        </ul>
        {onComment ? (
          <form
            className="cw-tables-comment"
            onSubmit={(e) => {
              e.preventDefault();
              const text = comment.trim();
              if (!text) return;
              onComment(text);
              setComment("");
            }}
          >
            <input
              className="cw-tables-input"
              placeholder={t("tables.panel.commentPlaceholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="submit" className="cw-tables-btn">
              {t("tables.panel.comment")}
            </button>
          </form>
        ) : null}
      </section>
    </aside>
  );
}
