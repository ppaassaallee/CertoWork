import { useMemo, useState } from "react";
import { Eye, EyeOff, Lock, Plus, Shield, X } from "../../components/ui/Icon";
import type {
  Column,
  ColumnAccess,
  ColumnAccessException,
  ColumnAccessLevel,
  ColumnAccessSubjectType,
} from "../../lib/tables";
import {
  columnAccessLabel,
  emptyColumnAccess,
  normalizeColumnAccess,
} from "../../lib/tables";
import { t } from "../../lib/i18n";

export type PropertyAccessMember = {
  id: string;
  name: string;
  email?: string;
  role?: string;
};

export type PropertyAccessModalProps = {
  columns: Column[];
  columnId: string;
  members?: PropertyAccessMember[];
  roles?: string[];
  onChangeColumn(columnId: string): void;
  onSave(columnId: string, access: ColumnAccess): void;
  onClose(): void;
};

const LEVELS: ColumnAccessLevel[] = ["full", "view", "none"];

function levelIcon(level: ColumnAccessLevel) {
  if (level === "full") return <Shield size={14} />;
  if (level === "view") return <Eye size={14} />;
  return <EyeOff size={14} />;
}

function newExceptionId() {
  return `exc_${Math.random().toString(36).slice(2, 9)}`;
}

export function PropertyAccessModal({
  columns,
  columnId,
  members = [],
  roles = ["owner", "admin", "member"],
  onChangeColumn,
  onSave,
  onClose,
}: PropertyAccessModalProps) {
  const column = columns.find((entry) => entry.id === columnId) || columns[0];
  const [draft, setDraft] = useState<ColumnAccess>(() =>
    column ? normalizeColumnAccess(column) : emptyColumnAccess(),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<ColumnAccessSubjectType>("user");
  const [addSubjectId, setAddSubjectId] = useState("");
  const [addAccess, setAddAccess] = useState<ColumnAccessLevel>("view");

  const usedUserIds = useMemo(
    () =>
      new Set(
        draft.exceptions
          .filter((entry) => entry.subjectType === "user")
          .map((entry) => entry.subjectId),
      ),
    [draft.exceptions],
  );

  if (!column) return null;

  const addException = () => {
    const subjectId = addSubjectId.trim();
    if (!subjectId) return;
    const member = members.find((entry) => entry.id === subjectId);
    const label =
      addType === "user"
        ? member?.name || member?.email || subjectId
        : subjectId;
    const next: ColumnAccessException = {
      id: newExceptionId(),
      subjectType: addType,
      subjectId,
      label,
      access: addAccess,
    };
    setDraft((current) => ({
      ...current,
      exceptions: [...current.exceptions, next],
    }));
    setAddOpen(false);
    setAddSubjectId("");
    setAddAccess("view");
  };

  return (
    <div className="cw-prop-access-scrim" data-testid="property-access-modal">
      <div
        className="cw-prop-access"
        role="dialog"
        aria-labelledby="cw-prop-access-title"
      >
        <header className="cw-prop-access-head">
          <div>
            <h2 id="cw-prop-access-title">{t("tables.access.title")}</h2>
            <label className="cw-prop-access-for">
              <span>{t("tables.access.for")}</span>
              <select
                aria-label={t("tables.access.for")}
                onChange={(event) => {
                  const nextId = event.target.value;
                  onChangeColumn(nextId);
                  const nextCol = columns.find((entry) => entry.id === nextId);
                  setDraft(
                    nextCol
                      ? normalizeColumnAccess(nextCol)
                      : emptyColumnAccess(),
                  );
                }}
                value={column.id}
              >
                {columns.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name || entry.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            aria-label={t("tables.panel.close")}
            className="cw-tables-icon-btn"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        <div className="cw-prop-access-default">
          <span className={`cw-prop-access-level-icon is-${draft.defaultAccess}`}>
            {levelIcon(draft.defaultAccess)}
          </span>
          <select
            aria-label={t("tables.access.default")}
            className="cw-prop-access-select"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                defaultAccess: event.target.value as ColumnAccessLevel,
              }))
            }
            value={draft.defaultAccess}
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`tables.access.level.${level}`)}
              </option>
            ))}
          </select>
        </div>

        <section className="cw-prop-access-exceptions">
          <h3>{t("tables.access.exceptions")}</h3>
          <p>{t("tables.access.exceptionsHelp")}</p>

          <ul>
            <li className="is-locked">
              <div className="cw-prop-access-subject">
                <Lock size={14} />
                <span>{t("tables.access.everyoneFull")}</span>
              </div>
              <span className="cw-prop-access-fixed">
                {columnAccessLabel("full")}
              </span>
            </li>
            {draft.exceptions.map((exception) => (
              <li key={exception.id}>
                <div className="cw-prop-access-subject">
                  <span className="cw-prop-access-avatar" aria-hidden>
                    {(exception.label || exception.subjectId).slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{exception.label || exception.subjectId}</strong>
                    <small>
                      {exception.subjectType === "user"
                        ? t("tables.access.subject.user")
                        : exception.subjectType === "role"
                          ? t("tables.access.subject.role")
                          : t("tables.access.subject.group")}
                    </small>
                  </div>
                </div>
                <div className="cw-prop-access-row-actions">
                  <select
                    aria-label={t("tables.access.exceptionAccess")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        exceptions: current.exceptions.map((entry) =>
                          entry.id === exception.id
                            ? {
                                ...entry,
                                access: event.target.value as ColumnAccessLevel,
                              }
                            : entry,
                        ),
                      }))
                    }
                    value={exception.access}
                  >
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {t(`tables.access.level.${level}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    aria-label={t("tables.access.removeException")}
                    className="cw-tables-icon-btn"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        exceptions: current.exceptions.filter(
                          (entry) => entry.id !== exception.id,
                        ),
                      }))
                    }
                    type="button"
                  >
                    <X size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {addOpen ? (
            <div className="cw-prop-access-add" data-testid="property-access-add">
              <select
                aria-label={t("tables.access.subjectType")}
                onChange={(event) => {
                  setAddType(event.target.value as ColumnAccessSubjectType);
                  setAddSubjectId("");
                }}
                value={addType}
              >
                <option value="user">{t("tables.access.subject.user")}</option>
                <option value="role">{t("tables.access.subject.role")}</option>
                <option value="group">{t("tables.access.subject.group")}</option>
              </select>
              {addType === "user" ? (
                <select
                  aria-label={t("tables.access.pickPerson")}
                  onChange={(event) => setAddSubjectId(event.target.value)}
                  value={addSubjectId}
                >
                  <option value="">{t("tables.access.pickPerson")}</option>
                  {members
                    .filter((member) => member.id && !usedUserIds.has(member.id))
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name || member.email || member.id}
                      </option>
                    ))}
                </select>
              ) : addType === "role" ? (
                <select
                  aria-label={t("tables.access.pickRole")}
                  onChange={(event) => setAddSubjectId(event.target.value)}
                  value={addSubjectId}
                >
                  <option value="">{t("tables.access.pickRole")}</option>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={t("tables.access.groupName")}
                  onChange={(event) => setAddSubjectId(event.target.value)}
                  placeholder={t("tables.access.groupPlaceholder")}
                  value={addSubjectId}
                />
              )}
              <select
                aria-label={t("tables.access.exceptionAccess")}
                onChange={(event) =>
                  setAddAccess(event.target.value as ColumnAccessLevel)
                }
                value={addAccess}
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`tables.access.level.${level}`)}
                  </option>
                ))}
              </select>
              <button
                className="cw-tables-btn-primary"
                disabled={!addSubjectId.trim()}
                onClick={addException}
                type="button"
              >
                {t("tables.access.add")}
              </button>
              <button
                className="cw-tables-btn-ghost"
                onClick={() => setAddOpen(false)}
                type="button"
              >
                {t("tables.access.cancel")}
              </button>
            </div>
          ) : (
            <button
              className="cw-prop-access-add-btn"
              data-testid="property-access-add-open"
              onClick={() => setAddOpen(true)}
              type="button"
            >
              <Plus size={14} />
              {t("tables.access.addException")}
            </button>
          )}
        </section>

        <footer className="cw-prop-access-foot">
          <a
            className="cw-prop-access-learn"
            href="https://certo.work"
            rel="noreferrer"
            target="_blank"
          >
            {t("tables.access.learnMore")}
          </a>
          <div>
            <button
              className="cw-tables-btn-ghost"
              onClick={() => setDraft(emptyColumnAccess())}
              type="button"
            >
              {t("tables.access.clear")}
            </button>
            <button
              className="cw-tables-btn-primary"
              data-testid="property-access-save"
              onClick={() => {
                onSave(column.id, {
                  defaultAccess: draft.defaultAccess,
                  exceptions: draft.exceptions,
                });
                onClose();
              }}
              type="button"
            >
              {t("tables.access.save")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
