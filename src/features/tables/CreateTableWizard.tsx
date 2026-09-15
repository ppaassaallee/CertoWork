import { useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "../../components/ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import { getLocale, t } from "../../lib/i18n";
import {
  compileRoutineSentence,
  saveRoutineDraft,
  type RoutineTrigger,
} from "../../lib/routines";
import {
  createTable,
  type Column,
  type CompiledTableSchema,
  type KeyColumns,
  type SuggestedAutomation,
  type TableTemplate,
  TABLE_TEMPLATES,
  templateDescription,
  templateDisplayName,
} from "../../lib/tables";
import { defaultKeyColumns, defaultTableColumns } from "./defaults";

export type CreateTableWizardProps = {
  open: boolean;
  onClose(): void;
  onCreated(tableId: string): void;
};

type WizardStep =
  | { kind: "gallery" }
  | {
      kind: "confirm";
      source: "template" | "phrase" | "blank";
      name: string;
      icon: string;
      color: string;
      columns: Column[];
      keyColumns: KeyColumns;
      templateId?: string | null;
      suggestedAutomation?: SuggestedAutomation | null;
    };

function buildAutomationTrigger(
  tableId: string,
  tableName: string,
  automation: SuggestedAutomation,
  locale: "es" | "en",
  keyColumns: KeyColumns,
): RoutineTrigger {
  const suggested = automation.trigger;
  if (suggested.kind === "record_created") {
    return {
      kind: "event",
      eventType: "table.record_created",
      filter: { tableId },
      cooldownSeconds: 60,
      human:
        locale === "en" ? "When a record is created" : "Cuando se cree un registro",
    };
  }
  if (suggested.kind === "status_changed") {
    return {
      kind: "event",
      eventType: "table.status_changed",
      filter: {
        tableId,
        columnId: keyColumns.status || undefined,
        to: suggested.statusTo,
      },
      cooldownSeconds: 60,
      human:
        locale === "en"
          ? `When status → ${suggested.statusTo}`
          : `Cuando el estado → ${suggested.statusTo}`,
    };
  }
  if (suggested.kind === "date_reached") {
    return {
      kind: "event",
      eventType: "table.date_reached",
      filter: {
        tableId,
        columnId: keyColumns.date || undefined,
        offsetDays: suggested.offsetDays,
      },
      cooldownSeconds: 86_400,
      human:
        suggested.offsetDays === 0
          ? locale === "en"
            ? "On the key date"
            : "El día de la fecha clave"
          : locale === "en"
            ? `${suggested.offsetDays} days before the date`
            : `${suggested.offsetDays} días antes de la fecha`,
    };
  }
  return {
    kind: "schedule",
    cron: suggested.cron,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    human: suggested.human || (locale === "en" ? `Schedule for ${tableName}` : `Agenda de ${tableName}`),
  };
}

function SchemaPreview(props: {
  name: string;
  columns: Column[];
  onNameChange(name: string): void;
  onRenameColumn(id: string, name: string): void;
  onRemoveColumn(id: string): void;
}) {
  return (
    <div className="cw-tables-create-preview" data-testid="tables-create-preview">
      <label className="cw-tables-create-field">
        <span>{t("tables.create.name")}</span>
        <input
          className="cw-tables-input"
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
          data-testid="tables-create-name"
        />
      </label>
      <ul className="cw-tables-create-col-list">
        {props.columns.map((col) => (
          <li key={col.id}>
            <input
              className="cw-tables-input"
              value={col.name}
              onChange={(e) => props.onRenameColumn(col.id, e.target.value)}
            />
            <span className="cw-tables-col-type">{col.type}</span>
            <button
              type="button"
              className="cw-tables-btn-ghost"
              onClick={() => props.onRemoveColumn(col.id)}
              disabled={props.columns.length <= 1}
            >
              {t("tables.columns.remove")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CreateTableWizard({ open, onClose, onCreated }: CreateTableWizardProps) {
  const { user, workspace } = useAuth();
  const locale = getLocale();
  const [step, setStep] = useState<WizardStep>({ kind: "gallery" });
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState<"compile" | "create" | null>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [enableAutomation, setEnableAutomation] = useState(false);

  const templates = useMemo(() => TABLE_TEMPLATES, []);

  if (!open) return null;

  const reset = () => {
    setStep({ kind: "gallery" });
    setPhrase("");
    setBusy(null);
    setError("");
    setQuestion("");
    setEnableAutomation(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const useTemplate = (template: TableTemplate) => {
    setError("");
    setQuestion("");
    setEnableAutomation(false);
    setStep({
      kind: "confirm",
      source: "template",
      name: templateDisplayName(template, locale),
      icon: template.icon,
      color: template.color,
      columns: template.columns.map((c) => ({
        ...c,
        options: c.options?.map((o) => ({ ...o })),
        tagOptions: c.tagOptions ? [...c.tagOptions] : undefined,
      })),
      keyColumns: { ...template.keyColumns },
      templateId: template.id,
      suggestedAutomation: template.suggestedAutomation,
    });
  };

  const useBlank = () => {
    setError("");
    setQuestion("");
    setEnableAutomation(false);
    setStep({
      kind: "confirm",
      source: "blank",
      name: t("tables.untitled"),
      icon: "▦",
      color: "var(--accent)",
      columns: defaultTableColumns(),
      keyColumns: defaultKeyColumns(),
      templateId: null,
      suggestedAutomation: null,
    });
  };

  const compilePhrase = async () => {
    if (!phrase.trim() || busy) return;
    if (!user?.uid || !workspace?.id) {
      setError(t("tables.create.needAuth"));
      return;
    }
    setBusy("compile");
    setError("");
    setQuestion("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/tables/compile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phrase: phrase.trim(),
          userId: user.uid,
          workspaceId: workspace.id,
          locale,
        }),
      });
      const payload = (await response.json()) as {
        schema?: CompiledTableSchema;
        question?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || t("tables.create.compileFailed"));
      }
      if (payload.question && !payload.schema) {
        setQuestion(payload.question);
        return;
      }
      if (!payload.schema) {
        throw new Error(t("tables.create.compileFailed"));
      }
      setStep({
        kind: "confirm",
        source: "phrase",
        name: payload.schema.name,
        icon: payload.schema.icon || "▦",
        color: "var(--accent)",
        columns: payload.schema.columns,
        keyColumns: payload.schema.keyColumns,
        templateId: null,
        suggestedAutomation: null,
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("tables.create.compileFailed"),
      );
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (step.kind !== "confirm" || !user?.uid || !workspace?.id || busy) return;
    const name = step.name.trim() || t("tables.untitled");
    if (!step.columns.length) {
      setError(t("tables.create.needColumns"));
      return;
    }
    setBusy("create");
    setError("");
    try {
      const id = await createTable({
        workspaceId: workspace.id,
        projectId: null,
        name,
        icon: step.icon,
        color: step.color,
        visibility: "workspace",
        columns: step.columns,
        keyColumns: step.keyColumns,
        createdBy: user.uid,
        favorite: false,
        templateId: step.templateId || null,
      });

      if (enableAutomation && step.suggestedAutomation) {
        const sentence =
          locale === "en"
            ? step.suggestedAutomation.sentenceEn
            : step.suggestedAutomation.sentenceEs;
        const trigger = buildAutomationTrigger(
          id,
          name,
          step.suggestedAutomation,
          locale,
          step.keyColumns,
        );
        const compiled = compileRoutineSentence({
          sentence,
          scope: {
            entityType: "table",
            entityId: id,
            entityTitle: name,
          },
          ownerEmail: user.email || undefined,
          triggerOverride: trigger,
        });
        if (compiled.spec.trigger.kind === "event") {
          compiled.spec.trigger.filter = {
            ...(compiled.spec.trigger.filter || {}),
            tableId: id,
          };
        }
        await saveRoutineDraft({
          workspaceId: workspace.id,
          ownerUserId: user.uid,
          compiled,
          activate: false,
        });
      }

      reset();
      onCreated(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tables.createFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      aria-label={t("tables.create.title")}
      aria-modal="true"
      className="do-skill-layer"
      data-testid="tables-create-wizard"
      role="dialog"
    >
      <section className="do-skill-modal cw-tables-create-modal">
        <header className="do-skill-head">
          <div className="do-skill-title">
            <span aria-hidden>▦</span>
            <div>
              <small>{t("tables.create.kicker")}</small>
              <h2>{t("tables.create.title")}</h2>
              <p>{t("tables.create.summary")}</p>
            </div>
          </div>
          <button aria-label={t("tables.create.close")} onClick={close} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="do-skill-body cw-tables-create-body">
          {step.kind === "gallery" ? (
            <>
              <div className="cw-tables-create-compose">
                <label className="cw-tables-create-phrase" htmlFor="tables-create-phrase">
                  <span className="sr-only">{t("tables.create.phraseLabel")}</span>
                  <input
                    id="tables-create-phrase"
                    data-testid="tables-create-phrase"
                    className="cw-tables-create-phrase-input"
                    placeholder={t("tables.create.phrasePlaceholder")}
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void compilePhrase();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="cw-tables-create-spark"
                    data-testid="tables-create-compile"
                    disabled={!phrase.trim() || busy === "compile"}
                    onClick={() => void compilePhrase()}
                    aria-label={t("tables.create.compile")}
                    title={t("tables.create.compile")}
                  >
                    {busy === "compile" ? (
                      <Loader2 size={16} className="cw-tables-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                  </button>
                </label>
                {question ? (
                  <p className="cw-tables-create-question" data-testid="tables-create-question">
                    {question}
                  </p>
                ) : (
                  <p className="cw-tables-create-hint">{t("tables.create.phraseHint")}</p>
                )}
              </div>

              <div className="cw-tables-create-divider">
                <span>{t("tables.create.orTemplates")}</span>
              </div>

              <div className="cw-tables-create-gallery" data-testid="tables-create-gallery">
                {templates.map((template) => (
                  <article key={template.id} className="cw-tables-create-card">
                    <header>
                      <span className="cw-tables-create-card-icon" style={{ color: template.color }}>
                        {template.icon}
                      </span>
                      <div>
                        <strong>{templateDisplayName(template, locale)}</strong>
                        <p>{templateDescription(template, locale)}</p>
                      </div>
                    </header>
                    <div className="cw-tables-create-chips" aria-label={t("tables.create.columns")}>
                      {template.columns.slice(0, 5).map((col) => (
                        <span key={col.id}>{col.name}</span>
                      ))}
                      {template.columns.length > 5 ? (
                        <span>+{template.columns.length - 5}</span>
                      ) : null}
                    </div>
                    <footer>
                      <span className="cw-tables-create-auto-hint">
                        {t("tables.create.suggestedAuto")}
                      </span>
                      <button
                        type="button"
                        className="cw-tables-btn"
                        data-testid={`tables-use-${template.id}`}
                        onClick={() => useTemplate(template)}
                      >
                        {t("tables.create.use")}
                      </button>
                    </footer>
                  </article>
                ))}
              </div>

              <button
                type="button"
                className="cw-tables-create-blank"
                data-testid="tables-create-blank"
                onClick={useBlank}
              >
                {t("tables.create.blank")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="cw-tables-btn-ghost cw-tables-create-back"
                onClick={() => {
                  setStep({ kind: "gallery" });
                  setEnableAutomation(false);
                  setError("");
                }}
              >
                ← {t("tables.create.back")}
              </button>

              <SchemaPreview
                name={step.name}
                columns={step.columns}
                onNameChange={(name) => setStep({ ...step, name })}
                onRenameColumn={(id, name) =>
                  setStep({
                    ...step,
                    columns: step.columns.map((c) => (c.id === id ? { ...c, name } : c)),
                  })
                }
                onRemoveColumn={(id) => {
                  if (step.columns.length <= 1) return;
                  const columns = step.columns.filter((c) => c.id !== id);
                  const keyColumns = { ...step.keyColumns };
                  if (keyColumns.title === id) keyColumns.title = columns[0]?.id || id;
                  if (keyColumns.status === id) keyColumns.status = null;
                  if (keyColumns.owner === id) keyColumns.owner = null;
                  if (keyColumns.date === id) keyColumns.date = null;
                  setStep({ ...step, columns, keyColumns });
                }}
              />

              {step.suggestedAutomation ? (
                <label className="cw-tables-create-toggle">
                  <input
                    type="checkbox"
                    checked={enableAutomation}
                    onChange={(e) => setEnableAutomation(e.target.checked)}
                    data-testid="tables-create-auto-toggle"
                  />
                  <span>
                    <strong>{t("tables.create.enableAuto")}</strong>
                    <small>
                      {locale === "en"
                        ? step.suggestedAutomation.sentenceEn
                        : step.suggestedAutomation.sentenceEs}
                    </small>
                    <em>{t("tables.create.autoDraftHint")}</em>
                  </span>
                </label>
              ) : null}
            </>
          )}

          {error ? <p className="do-skill-error cw-tables-create-error">{error}</p> : null}
        </div>

        <footer className="do-skill-foot cw-tables-create-foot">
          {step.kind === "gallery" ? (
            <span>{t("tables.create.footHint")}</span>
          ) : (
            <span>
              {step.columns.length} {t("tables.create.columns").toLowerCase()}
            </span>
          )}
          <div>
            <button type="button" onClick={close}>
              {t("tables.create.cancel")}
            </button>
            {step.kind === "confirm" ? (
              <button
                type="button"
                className="do-skill-create"
                data-testid="tables-create-submit"
                disabled={busy === "create"}
                onClick={() => void create()}
              >
                {busy === "create" ? (
                  <Loader2 size={14} className="cw-tables-spin" />
                ) : (
                  <Sparkles size={14} />
                )}{" "}
                {t("tables.create.submit")}
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}
