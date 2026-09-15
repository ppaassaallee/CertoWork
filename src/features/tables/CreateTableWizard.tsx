import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { DestructiveDialog } from "../../components/ui/DestructiveDialog";
import {
  Calendar,
  Check,
  ChevronDown,
  CircleDot,
  File,
  Icon,
  Loader2,
  Sparkles,
  User,
  X,
  type IconName,
} from "../../components/ui/Icon";
import { Kbd } from "../../components/ui/Kbd";
import { useAuth } from "../../lib/AuthContext";
import { getLocale, t, type MessageKey } from "../../lib/i18n";
import {
  compileRoutineSentence,
  saveRoutineDraft,
  type RoutineTrigger,
} from "../../lib/routines";
import {
  createRecord,
  createTable,
  compileTablePhrase,
  resolveSampleCell,
  sampleRowsToRecordValues,
  templateAutoHint,
  templateDisplayName,
  templateShortDescription,
  type Column,
  type ColumnType,
  type CompiledTableSchema,
  type KeyColumns,
  type SuggestedAutomation,
  type TableDoc,
  type TableTemplate,
  type TableVisibility,
  TABLE_TEMPLATES,
} from "../../lib/tables";
import { ColumnsEditor } from "./ColumnsEditor";
import "./createTable.css";

export type CreateTableWizardProps = {
  open: boolean;
  onClose(): void;
  onCreated(table: TableDoc): void;
};

type PreviewSource = "template" | "phrase";

type PreviewState = {
  source: PreviewSource;
  name: string;
  iconName: string;
  iconBg: string;
  iconFg: string;
  color: string;
  columns: Column[];
  keyColumns: KeyColumns;
  templateId: string | null;
  suggestedAutomation: SuggestedAutomation | null;
  sampleRows: Array<Record<string, string>>;
  dirty: boolean;
};

const EXAMPLE_PHRASE_KEYS = [
  "tables.create.example1",
  "tables.create.example2",
  "tables.create.example3",
] as const;

const EXAMPLE_CHIP_KEYS = [
  "tables.create.chip1",
  "tables.create.chip2",
  "tables.create.chip3",
] as const;

const EXAMPLE_CHIP_PHRASES = [
  "tables.create.chip1Phrase",
  "tables.create.chip2Phrase",
  "tables.create.chip3Phrase",
] as const;

const TYPE_LABEL: Partial<Record<ColumnType, MessageKey>> = {
  text: "tables.create.type.text",
  longtext: "tables.create.type.longtext",
  status: "tables.create.type.status",
  person: "tables.create.type.person",
  date: "tables.create.type.date",
  currency: "tables.create.type.currency",
  number: "tables.create.type.number",
  file: "tables.create.type.file",
  tags: "tables.create.type.tags",
  url: "tables.create.type.url",
  email: "tables.create.type.email",
  phone: "tables.create.type.phone",
  checkbox: "tables.create.type.checkbox",
};

function typeIcon(type: ColumnType) {
  switch (type) {
    case "status":
      return <CircleDot size={12} />;
    case "person":
      return <User size={12} />;
    case "date":
      return <Calendar size={12} />;
    case "currency":
    case "number":
      return <span aria-hidden style={{ fontSize: 11, color: "var(--text-muted)" }}>$</span>;
    case "file":
      return <File size={12} />;
    default:
      return <span aria-hidden style={{ fontSize: 10, color: "var(--text-muted)" }}>Aa</span>;
  }
}

function templateIcon(name: string, size = 12) {
  return <Icon name={name as IconName} size={size} />;
}

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

function inventSampleRows(columns: Column[], locale: "es" | "en"): Array<Record<string, string>> {
  const people = locale === "en" ? ["Alex", "Sam", "Jordan"] : ["Regina", "Edgar", "César"];
  const titles =
    locale === "en"
      ? ["Acme renewal", "Northwind deal", "Contoso access"]
      : ["Brevo · correo", "Cloudflare", "Chatwoot"];
  const dates = ["Sep 30", "Dic 1", "Sep 10"];
  const amounts = ["$180", "$240", "$99"];
  return [0, 1, 2].map((i) => {
    const row: Record<string, string> = {};
    for (const col of columns) {
      if (col.type === "status" && col.options?.length) {
        row[col.id] = col.options[Math.min(i, col.options.length - 1)].id;
      } else if (col.type === "person") {
        row[col.id] = people[i];
      } else if (col.type === "date") {
        row[col.id] = dates[i];
      } else if (col.type === "currency" || col.type === "number") {
        row[col.id] = amounts[i];
      } else if (col.type === "file") {
        row[col.id] = "PDF";
      } else {
        row[col.id] = titles[i];
      }
    }
    return row;
  });
}

function MiniTable(props: {
  columns: Column[];
  rows: Array<Record<string, string>>;
  maxCols?: number;
  large?: boolean;
  enter?: boolean;
}) {
  const cols = props.columns.slice(0, props.maxCols ?? 4);
  const grid = {
    gridTemplateColumns: cols
      .map((c, i) => (i === 0 ? "1.6fr" : c.type === "currency" || c.type === "number" ? "0.9fr" : "1fr"))
      .join(" "),
  };
  const opacities = [1, 0.6, 0.35];
  return (
    <div
      className={`cw-tables-create-mini${props.large ? " is-lg" : ""}${props.enter ? " is-enter" : ""}`}
      data-testid="tables-create-mini"
    >
      <div className="cw-tables-create-mini-r" style={grid}>
        {cols.map((c) => (
          <span key={c.id}>{c.name}</span>
        ))}
      </div>
      {props.rows.slice(0, props.large ? 3 : 2).map((row, ri) => (
        <div
          key={ri}
          className="cw-tables-create-mini-r"
          style={{ ...grid, opacity: props.large ? opacities[ri] ?? 0.35 : 1 }}
        >
          {cols.map((c) => {
            const cell = resolveSampleCell(props.columns, c.id, row[c.id]);
            if (cell.tone) {
              return (
                <span key={c.id}>
                  <span className={`cw-tables-create-st cw-tables-tone-${cell.tone}`}>
                    {cell.text}
                  </span>
                </span>
              );
            }
            return <span key={c.id}>{cell.text}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

export function CreateTableWizard({ open, onClose, onCreated }: CreateTableWizardProps) {
  const { user, workspace } = useAuth();
  const locale = getLocale();
  const [phrase, setPhrase] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [busy, setBusy] = useState<"compile" | "create" | null>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [enableAutomation, setEnableAutomation] = useState(false);
  const [includeSamples, setIncludeSamples] = useState(false);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [visibility, setVisibility] = useState<TableVisibility>("workspace");
  const [columnsEditorOpen, setColumnsEditorOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const phraseRef = useRef<HTMLTextAreaElement>(null);

  const templates = useMemo(() => TABLE_TEMPLATES, []);
  const visibleTemplates = showAllTemplates ? templates : templates.slice(0, 4);

  useEffect(() => {
    if (!open || phrase.trim()) return;
    const id = window.setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % EXAMPLE_PHRASE_KEYS.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [open, phrase]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && preview) {
        event.preventDefault();
        void create();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bind once per open/preview
  }, [open, preview, busy]);

  if (!open) return null;

  const reset = () => {
    setPhrase("");
    setBusy(null);
    setError("");
    setQuestion("");
    setPreview(null);
    setEnableAutomation(false);
    setIncludeSamples(false);
    setShowAllTemplates(false);
    setVisibility("workspace");
    setColumnsEditorOpen(false);
    setDiscardOpen(false);
  };

  const requestClose = () => {
    if (preview?.dirty) {
      setDiscardOpen(true);
      return;
    }
    reset();
    onClose();
  };

  const forceClose = () => {
    reset();
    onClose();
  };

  const loadTemplate = (template: TableTemplate) => {
    setError("");
    setQuestion("");
    setEnableAutomation(false);
    setColumnsEditorOpen(false);
    setPreview({
      source: "template",
      name: templateDisplayName(template, locale),
      iconName: template.iconName,
      iconBg: template.iconBg,
      iconFg: template.iconFg,
      color: template.color,
      columns: template.columns.map((c) => ({
        ...c,
        options: c.options?.map((o) => ({ ...o })),
        tagOptions: c.tagOptions ? [...c.tagOptions] : undefined,
      })),
      keyColumns: { ...template.keyColumns },
      templateId: template.id,
      suggestedAutomation: template.suggestedAutomation,
      sampleRows: template.sampleRows.map((r) => ({ ...r })),
      dirty: false,
    });
  };

  const applyCompiled = (schema: CompiledTableSchema) => {
    const columns = schema.columns;
    setPreview({
      source: "phrase",
      name: schema.name,
      iconName: "Sparkles",
      iconBg: "#EEEDFE",
      iconFg: "#3C3489",
      color: "var(--accent)",
      columns,
      keyColumns: schema.keyColumns,
      templateId: null,
      suggestedAutomation: null,
      sampleRows: inventSampleRows(columns, locale),
      dirty: false,
    });
  };

  const compilePhrase = async (override?: string) => {
    const text = (override ?? phrase).trim();
    if (!text || busy) return;
    if (!user?.uid || !workspace?.id) {
      setError(t("tables.create.needAuth"));
      return;
    }
    if (override) setPhrase(override);
    setBusy("compile");
    setError("");
    setQuestion("");
    setColumnsEditorOpen(false);
    try {
      let schema: CompiledTableSchema | undefined;
      let clarifying: string | undefined;

      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/tables/compile", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            phrase: text,
            userId: user.uid,
            workspaceId: workspace.id,
            locale,
          }),
        });
        if (response.ok) {
          const payload = (await response.json()) as {
            schema?: CompiledTableSchema;
            question?: string;
            error?: string;
          };
          schema = payload.schema;
          clarifying = payload.question;
        }
      } catch {
        /* fall through to local compiler */
      }

      if (!schema && !clarifying) {
        const local = compileTablePhrase({ phrase: text, locale });
        schema = local.schema;
        clarifying = local.question;
      }

      if (clarifying && !schema) {
        setQuestion(clarifying);
        return;
      }
      if (!schema) {
        throw new Error(t("tables.create.compileFailed"));
      }
      applyCompiled(schema);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("tables.create.compileFailed"),
      );
    } finally {
      setBusy(null);
    }
  };

  const onPhraseKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void compilePhrase();
    }
  };

  const create = async () => {
    if (!preview || !user?.uid || !workspace?.id || busy) return;
    const name = preview.name.trim() || t("tables.untitled");
    if (!preview.columns.length) {
      setError(t("tables.create.needColumns"));
      return;
    }
    setBusy("create");
    setError("");
    try {
      const now = new Date().toISOString();
      const id = await createTable({
        workspaceId: workspace.id,
        projectId: null,
        name,
        icon: preview.iconName === "Sparkles" ? "✦" : "▦",
        color: preview.color,
        visibility,
        columns: preview.columns,
        keyColumns: preview.keyColumns,
        createdBy: user.uid,
        favorite: false,
        templateId: preview.templateId || null,
      });

      let sampleCount = 0;
      if (
        includeSamples &&
        preview.source === "template" &&
        preview.sampleRows.length
      ) {
        for (const row of preview.sampleRows.slice(0, 2)) {
          await createRecord({
            tableId: id,
            workspaceId: workspace.id,
            values: sampleRowsToRecordValues(preview.columns, row),
            actorId: user.uid,
          });
          sampleCount += 1;
        }
      }

      if (enableAutomation && preview.suggestedAutomation) {
        const sentence =
          locale === "en"
            ? preview.suggestedAutomation.sentenceEn
            : preview.suggestedAutomation.sentenceEs;
        const trigger = buildAutomationTrigger(
          id,
          name,
          preview.suggestedAutomation,
          locale,
          preview.keyColumns,
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
        try {
          sessionStorage.setItem(
            "certo.openTableAutomation",
            JSON.stringify({ tableId: id, at: Date.now() }),
          );
        } catch {
          /* ignore */
        }
      }

      const created: TableDoc = {
        id,
        workspaceId: workspace.id,
        projectId: null,
        name,
        icon: preview.iconName === "Sparkles" ? "✦" : "▦",
        color: preview.color,
        visibility,
        columns: preview.columns,
        keyColumns: preview.keyColumns,
        recordCount: sampleCount,
        templateId: preview.templateId || null,
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
        favorite: false,
      };

      reset();
      onCreated(created);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tables.createFailed"));
    } finally {
      setBusy(null);
    }
  };

  const draftTable: TableDoc | null = preview
    ? {
        id: "draft",
        workspaceId: workspace?.id || "",
        projectId: null,
        name: preview.name,
        icon: "▦",
        color: preview.color,
        visibility,
        columns: preview.columns,
        keyColumns: preview.keyColumns,
        recordCount: 0,
        templateId: preview.templateId,
        createdBy: user?.uid || "",
        createdAt: "",
        updatedAt: "",
      }
    : null;

  const statusCol = preview?.columns.find((c) => c.id === preview.keyColumns.status);
  const statusOptions = statusCol?.options || [];
  const dateCol = preview?.columns.find((c) => c.id === preview.keyColumns.date);
  const ownerCol = preview?.columns.find((c) => c.id === preview.keyColumns.owner);
  const scopeLabel =
    visibility === "private"
      ? t("tables.create.scope.personal")
      : visibility === "project"
        ? t("tables.create.scope.project")
        : t("tables.create.scope.team");

  const cycleScope = () => {
    setVisibility((v) =>
      v === "workspace" ? "private" : v === "private" ? "project" : "workspace",
    );
    if (preview) setPreview({ ...preview, dirty: true });
  };

  return (
    <div
      aria-label={t("tables.create.title")}
      aria-modal="true"
      className="do-skill-layer cw-tables-create-layer"
      data-testid="tables-create-wizard"
      role="dialog"
    >
      <section className="cw-tables-create-modal">
        <header className="cw-tables-create-head">
          <span className="cw-tables-create-head-title">{t("tables.create.title")}</span>
          <span className="cw-tables-create-head-sub">{t("tables.create.summary")}</span>
          <span className="cw-tables-create-head-spacer" />
          <button
            aria-label={t("tables.create.close")}
            className="cw-tables-create-close"
            onClick={requestClose}
            type="button"
          >
            <X size={14} />
          </button>
        </header>

        <div className="cw-tables-create-body">
          <div className="cw-tables-create-left">
            <div
              className={`cw-tables-create-halo${busy === "compile" ? " is-compiling" : ""}`}
            >
              <label className="cw-tables-create-phrase" htmlFor="tables-create-phrase">
                <Sparkles size={14} className="cw-tables-create-phrase-icon" aria-hidden />
                <span className="sr-only">{t("tables.create.phraseLabel")}</span>
                <textarea
                  id="tables-create-phrase"
                  ref={phraseRef}
                  data-testid="tables-create-phrase"
                  className="cw-tables-create-phrase-input"
                  placeholder={t(EXAMPLE_PHRASE_KEYS[placeholderIdx])}
                  value={phrase}
                  rows={3}
                  onChange={(e) => setPhrase(e.target.value)}
                  onKeyDown={onPhraseKeyDown}
                />
              </label>
            </div>

            <div className="cw-tables-create-examples">
              {EXAMPLE_CHIP_KEYS.map((key, i) => (
                <button
                  key={key}
                  type="button"
                  className="cw-tables-create-ex"
                  onClick={() => void compilePhrase(t(EXAMPLE_CHIP_PHRASES[i]))}
                >
                  {t(key)}
                </button>
              ))}
            </div>

            {question ? (
              <p className="cw-tables-create-question" data-testid="tables-create-question">
                {question}
              </p>
            ) : null}

            <div className="cw-tables-create-eyebrow">{t("tables.create.orTemplates")}</div>
            <div className="cw-tables-create-gallery" data-testid="tables-create-gallery">
              {visibleTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`cw-tables-create-card${
                    preview?.templateId === template.id ? " is-on" : ""
                  }`}
                  data-testid={`tables-use-${template.id}`}
                  onClick={() => loadTemplate(template)}
                >
                  <div className="cw-tables-create-card-h">
                    <span
                      className="cw-tables-create-card-ic"
                      style={{ background: template.iconBg, color: template.iconFg }}
                    >
                      {templateIcon(template.iconName, 12)}
                    </span>
                    <div className="cw-tables-create-card-meta">
                      <div className="cw-tables-create-card-n">
                        {templateDisplayName(template, locale)}
                      </div>
                      <div className="cw-tables-create-card-d">
                        {templateShortDescription(template, locale)}
                      </div>
                    </div>
                  </div>
                  <MiniTable
                    columns={template.columns}
                    rows={template.sampleRows}
                    maxCols={4}
                  />
                  <div className="cw-tables-create-card-f">
                    <Sparkles size={9} aria-hidden />
                    <span>{templateAutoHint(template, locale)}</span>
                  </div>
                </button>
              ))}
            </div>
            {!showAllTemplates && templates.length > 4 ? (
              <button
                type="button"
                className="cw-tables-create-more"
                onClick={() => setShowAllTemplates(true)}
              >
                {t("tables.create.moreTemplates")}
              </button>
            ) : null}

            {error ? <p className="cw-tables-create-error">{error}</p> : null}
          </div>

          <div className="cw-tables-create-right" data-testid="tables-create-preview">
            {busy === "compile" && !preview ? (
              <div className="cw-tables-create-empty" aria-busy="true">
                <div className="cw-tables-create-skeleton-table">
                  <div
                    className="cw-tables-create-mini-r"
                    style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1fr" }}
                  >
                    <span /><span /><span /><span />
                  </div>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="cw-tables-create-mini-r"
                      style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1fr" }}
                    >
                      <span /><span /><span /><span />
                    </div>
                  ))}
                </div>
                <p className="cw-tables-create-empty-msg">{t("tables.create.compiling")}</p>
              </div>
            ) : !preview ? (
              <div className="cw-tables-create-empty">
                <div className="cw-tables-create-skeleton-table" aria-hidden>
                  <div
                    className="cw-tables-create-mini-r"
                    style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1fr" }}
                  >
                    <span /><span /><span /><span />
                  </div>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="cw-tables-create-mini-r"
                      style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1fr" }}
                    >
                      <span /><span /><span /><span />
                    </div>
                  ))}
                </div>
                <p className="cw-tables-create-empty-msg">{t("tables.create.previewEmpty")}</p>
              </div>
            ) : columnsEditorOpen && draftTable ? (
              <div className="cw-tables-create-editor-wrap">
                <ColumnsEditor
                  table={draftTable}
                  onClose={() => setColumnsEditorOpen(false)}
                  onChange={(columns, keyColumns) =>
                    setPreview({
                      ...preview,
                      columns,
                      keyColumns,
                      dirty: true,
                    })
                  }
                />
              </div>
            ) : (
              <>
                <div className="cw-tables-create-identity">
                  <button
                    type="button"
                    className="cw-tables-create-identity-ic"
                    style={{ background: preview.iconBg, color: preview.iconFg }}
                    aria-label={t("tables.create.icon")}
                    onClick={() => setPreview({ ...preview, dirty: true })}
                  >
                    {templateIcon(preview.iconName, 12)}
                  </button>
                  <input
                    className="cw-tables-create-name"
                    value={preview.name}
                    data-testid="tables-create-name"
                    onChange={(e) =>
                      setPreview({ ...preview, name: e.target.value, dirty: true })
                    }
                  />
                  <button
                    type="button"
                    className="cw-tables-create-scope"
                    onClick={cycleScope}
                  >
                    {scopeLabel} <ChevronDown size={10} />
                  </button>
                  <span className="cw-tables-create-preview-label">
                    {t("tables.create.previewEditable")}
                  </span>
                </div>

                <MiniTable
                  columns={preview.columns}
                  rows={preview.sampleRows}
                  maxCols={6}
                  large
                  enter
                />

                <div className="cw-tables-create-schema">
                  <div>
                    <div className="cw-tables-create-eyebrow">
                      {t("tables.create.columns")} · {preview.columns.length}
                    </div>
                    {preview.columns.map((col, i) => (
                      <div
                        key={col.id}
                        className="cw-tables-create-col-row is-enter"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        {typeIcon(col.type)}
                        <span>{col.name}</span>
                        <span className="cw-tables-create-col-type">
                          {col.id === preview.keyColumns.title && col.type === "text"
                            ? t("tables.create.type.title")
                            : t(TYPE_LABEL[col.type] || "tables.create.type.text")}
                        </span>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="cw-tables-create-edit-cols"
                      onClick={() => setColumnsEditorOpen(true)}
                    >
                      {t("tables.create.editColumns")}
                    </button>
                  </div>

                  <div>
                    {statusOptions.length ? (
                      <>
                        <div className="cw-tables-create-eyebrow">
                          {t("tables.create.statusOptions")}
                        </div>
                        <div className="cw-tables-create-status-opts">
                          {statusOptions.map((opt) => (
                            <span
                              key={opt.id}
                              className={`cw-tables-create-sto cw-tables-tone-${opt.tone}`}
                            >
                              {opt.label}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}

                    <div className="cw-tables-create-eyebrow">
                      {t("tables.create.keyColumns")}
                    </div>
                    <div className="cw-tables-create-keys">
                      <span
                        className={`cw-tables-create-key${
                          preview.keyColumns.status ? " is-ok" : " is-miss"
                        }`}
                      >
                        {preview.keyColumns.status ? <Check size={9} /> : null}
                        {preview.keyColumns.status
                          ? t("tables.create.key.status")
                          : t("tables.create.key.pickStatus")}
                      </span>
                      <span
                        className={`cw-tables-create-key${
                          preview.keyColumns.owner ? " is-ok" : " is-miss"
                        }`}
                      >
                        {preview.keyColumns.owner ? <Check size={9} /> : null}
                        {preview.keyColumns.owner
                          ? ownerCol?.name || t("tables.create.key.owner")
                          : t("tables.create.key.pickOwner")}
                      </span>
                      <span
                        className={`cw-tables-create-key${
                          preview.keyColumns.date ? " is-ok" : " is-miss"
                        }`}
                      >
                        {preview.keyColumns.date ? <Check size={9} /> : null}
                        {preview.keyColumns.date
                          ? `${t("tables.create.key.date")}: ${dateCol?.name || ""}`
                          : t("tables.create.key.pickDate")}
                      </span>
                    </div>
                    <p className="cw-tables-create-key-hint">{t("tables.create.keyHint")}</p>

                    {preview.suggestedAutomation ? (
                      <div className="cw-tables-create-auto">
                        <Sparkles size={12} aria-hidden />
                        <div className="cw-tables-create-auto-body">
                          {locale === "en"
                            ? preview.suggestedAutomation.sentenceEn
                            : preview.suggestedAutomation.sentenceEs}
                          <span className="cw-tables-create-auto-note">
                            {t("tables.create.autoDraftHint")}
                          </span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enableAutomation}
                          className={`cw-tables-create-switch${enableAutomation ? " is-on" : ""}`}
                          data-testid="tables-create-auto-toggle"
                          onClick={() => setEnableAutomation((v) => !v)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="cw-tables-create-foot">
          <span className="cw-tables-create-foot-hint">{t("tables.create.hint")}</span>
          <div className="cw-tables-create-foot-actions">
            {preview?.source === "template" ? (
              <label className="cw-tables-create-include">
                <input
                  type="checkbox"
                  checked={includeSamples}
                  onChange={(e) => setIncludeSamples(e.target.checked)}
                />
                {t("tables.create.includeSamples")}
              </label>
            ) : null}
            <button type="button" className="cw-tables-create-cancel" onClick={requestClose}>
              {t("tables.create.cancel")}
            </button>
            {preview ? (
              <button
                type="button"
                className="cw-tables-create-submit"
                data-testid="tables-create-submit"
                disabled={busy === "create"}
                onClick={() => void create()}
              >
                {busy === "create" ? (
                  <Loader2 size={14} className="cw-tables-spin" />
                ) : null}
                {t("tables.create.submit")} <Kbd>⌘↵</Kbd>
              </button>
            ) : null}
          </div>
        </footer>
      </section>

      <DestructiveDialog
        open={discardOpen}
        verb={t("tables.create.discard")}
        entityName={t("tables.create.draft")}
        impact={[t("tables.create.discardImpact")]}
        confirmLabel={t("tables.create.discard")}
        cancelLabel={t("tables.create.cancel")}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => forceClose()}
      />
    </div>
  );
}
