import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X, Zap } from "../../components/ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import { getLocale, t } from "../../lib/i18n";
import {
  activateRoutine,
  compileRoutineSentence,
  listRoutinesForScope,
  pauseRoutine,
  saveRoutineDraft,
  type RoutineSpec,
  type RoutineTrigger,
} from "../../lib/routines";
import type { StatusOption, TableDoc } from "../../lib/tables";

export type TableAutomationComposerProps = {
  open: boolean;
  table: TableDoc;
  onClose(): void;
};

type TriggerKind = "status_changed" | "record_created" | "date_reached";

type ActionChip =
  | "create_item"
  | "create_ticket"
  | "create_note"
  | "assign"
  | "change_status"
  | "notify"
  | "ask_odysseus";

const ACTION_CHIPS: ActionChip[] = [
  "create_item",
  "create_ticket",
  "create_note",
  "assign",
  "change_status",
  "notify",
  "ask_odysseus",
];

const MAX_ACTIONS = 5;

function statusOptions(table: TableDoc): StatusOption[] {
  const colId = table.keyColumns.status;
  if (!colId) return [];
  const col = table.columns.find((c) => c.id === colId);
  return col?.options || [];
}

function dateColumnLabel(table: TableDoc): string {
  const colId = table.keyColumns.date;
  if (!colId) return t("tables.automation.dateColumn");
  return table.columns.find((c) => c.id === colId)?.name || t("tables.automation.dateColumn");
}

function buildTrigger(input: {
  kind: TriggerKind;
  table: TableDoc;
  statusTo: string;
  offsetDays: number;
  locale: "es" | "en";
}): RoutineTrigger {
  const tableId = input.table.id;
  if (input.kind === "record_created") {
    return {
      kind: "event",
      eventType: "table.record_created",
      filter: { tableId },
      cooldownSeconds: 60,
      human:
        input.locale === "en" ? "When a record is created" : "Cuando se cree un registro",
    };
  }
  if (input.kind === "status_changed") {
    const to = input.statusTo;
    const opt = statusOptions(input.table).find((o) => o.id === to);
    const label = opt?.label || to || "…";
    return {
      kind: "event",
      eventType: "table.status_changed",
      filter: {
        tableId,
        columnId: input.table.keyColumns.status || undefined,
        ...(to ? { to } : {}),
      },
      cooldownSeconds: 60,
      human:
        input.locale === "en" ? `When status → ${label}` : `Cuando el estado → ${label}`,
    };
  }
  const n = Math.max(0, Number(input.offsetDays) || 0);
  const dateLabel = dateColumnLabel(input.table);
  return {
    kind: "event",
    eventType: "table.date_reached",
    filter: {
      tableId,
      columnId: input.table.keyColumns.date || undefined,
      offsetDays: n,
    },
    cooldownSeconds: 86_400,
    human:
      n === 0
        ? input.locale === "en"
          ? `On ${dateLabel}`
          : `El día de ${dateLabel}`
        : input.locale === "en"
          ? `${n} days before ${dateLabel}`
          : `${n} días antes de ${dateLabel}`,
  };
}

function actionLabel(chip: ActionChip): string {
  switch (chip) {
    case "create_item":
      return t("tables.automation.action.create_item");
    case "create_ticket":
      return t("tables.automation.action.create_ticket");
    case "create_note":
      return t("tables.automation.action.create_note");
    case "assign":
      return t("tables.automation.action.assign");
    case "change_status":
      return t("tables.automation.action.change_status");
    case "notify":
      return t("tables.automation.action.notify");
    case "ask_odysseus":
      return t("tables.automation.action.ask_odysseus");
  }
}

function buildSentence(input: {
  trigger: RoutineTrigger;
  actions: ActionChip[];
  locale: "es" | "en";
  tableName: string;
}): string {
  const when = input.trigger.human;
  const then =
    input.actions.length === 0
      ? input.locale === "en"
        ? "notify me"
        : "notificarme"
      : input.actions
          .map((a) => {
            const label = actionLabel(a).toLowerCase();
            return label;
          })
          .join(input.locale === "en" ? ", then " : ", luego ");
  if (input.locale === "en") {
    return `${when} on ${input.tableName}, then ${then}`;
  }
  return `${when} en ${input.tableName}, entonces ${then}`;
}

export function TableAutomationComposer({
  open,
  table,
  onClose,
}: TableAutomationComposerProps) {
  const { user, workspace } = useAuth();
  const locale = getLocale() === "en" ? "en" : "es";
  const options = useMemo(() => statusOptions(table), [table]);

  const [routines, setRoutines] = useState<RoutineSpec[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [mode, setMode] = useState<"list" | "create">("list");

  const [triggerKind, setTriggerKind] = useState<TriggerKind>("status_changed");
  const [statusTo, setStatusTo] = useState(options[0]?.id || "");
  const [offsetDays, setOffsetDays] = useState(3);
  const [actions, setActions] = useState<ActionChip[]>(["notify"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const reload = async () => {
    if (!workspace?.id) return;
    setLoadingList(true);
    try {
      const rows = await listRoutinesForScope(workspace.id, {
        entityType: "table",
        entityId: table.id,
      });
      setRoutines(
        rows.filter(
          (r) =>
            r.trigger?.kind === "event" &&
            String((r.trigger as { eventType?: string }).eventType || "").startsWith("table."),
        ),
      );
    } catch {
      setRoutines([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setMode("list");
    setError("");
    setBusy(false);
    setActions(["notify"]);
    setTriggerKind("status_changed");
    setStatusTo(options[0]?.id || "");
    setOffsetDays(3);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, table.id, workspace?.id]);

  const trigger = useMemo(
    () =>
      buildTrigger({
        kind: triggerKind,
        table,
        statusTo,
        offsetDays,
        locale,
      }),
    [triggerKind, table, statusTo, offsetDays, locale],
  );

  const sentence = useMemo(
    () =>
      buildSentence({
        trigger,
        actions,
        locale,
        tableName: table.name,
      }),
    [trigger, actions, locale, table.name],
  );

  if (!open) return null;

  const toggleAction = (chip: ActionChip) => {
    setActions((prev) => {
      if (prev.includes(chip)) return prev.filter((a) => a !== chip);
      if (prev.length >= MAX_ACTIONS) return prev;
      return [...prev, chip];
    });
  };

  const save = async () => {
    if (!user || !workspace) {
      setError(t("tables.automation.needAuth"));
      return;
    }
    if (triggerKind === "status_changed" && !table.keyColumns.status) {
      setError(t("tables.automation.needStatus"));
      return;
    }
    if (triggerKind === "date_reached" && !table.keyColumns.date) {
      setError(t("tables.automation.needDate"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const compiled = compileRoutineSentence({
        sentence,
        scope: {
          entityType: "table",
          entityId: table.id,
          entityTitle: table.name,
        },
        ownerEmail: user.email || undefined,
        triggerOverride: trigger,
      });
      // Ensure table filter is present even if NL merge somehow dropped it.
      if (compiled.spec.trigger.kind === "event") {
        compiled.spec.trigger.filter = {
          ...(compiled.spec.trigger.filter || {}),
          tableId: table.id,
        };
      }
      const approved = [
        ...actions.map((a) => {
          if (a === "create_item") return "create_task";
          if (a === "create_ticket") return "create_ticket";
          if (a === "create_note") return "create_note_from_template";
          if (a === "assign" || a === "change_status") return "update_record_field";
          if (a === "notify") return "outbox_communication";
          return "analyze";
        }),
      ];
      compiled.spec.permissions = {
        ...compiled.spec.permissions,
        approvedActionTypes: [...new Set(approved)],
        editItems: actions.some((a) =>
          ["create_item", "assign", "change_status"].includes(a),
        )
          ? "ask"
          : compiled.spec.permissions.editItems,
      };
      await saveRoutineDraft({
        workspaceId: workspace.id,
        ownerUserId: user.uid,
        compiled,
        activate: true,
      });
      setMode("list");
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("tables.automation.saveFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (routine: RoutineSpec) => {
    setTogglingId(routine.id);
    try {
      if (routine.status === "active") {
        await pauseRoutine(routine.id);
      } else {
        await activateRoutine(routine);
      }
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("tables.automation.toggleFailed"),
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div
      aria-label={t("tables.automation.title")}
      aria-modal="true"
      className="do-skill-layer"
      data-testid="table-automation-composer"
      role="dialog"
    >
      <section className="do-skill-modal cw-tables-auto-modal">
        <header className="do-skill-head">
          <div className="do-skill-title">
            <span>
              <Zap size={18} />
            </span>
            <div>
              <small>{t("tables.automation.kicker")}</small>
              <h2>{t("tables.automation.title")}</h2>
              <p>{t("tables.automation.summary").replace("{table}", table.name)}</p>
            </div>
          </div>
          <button aria-label={t("tables.automation.close")} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="do-skill-body cw-tables-auto-body">
          {mode === "list" ? (
            <main className="do-skill-form cw-tables-auto-list">
              <div className="cw-tables-auto-list-head">
                <h3>{t("tables.automation.listTitle")}</h3>
                <button
                  className="cw-tables-btn"
                  onClick={() => {
                    setMode("create");
                    setError("");
                  }}
                  type="button"
                >
                  <Plus size={14} />
                  {t("tables.automation.new")}
                </button>
              </div>

              {loadingList ? (
                <p className="cw-tables-muted">
                  <Loader2 size={14} className="cw-tables-spin" /> {t("tables.automation.loading")}
                </p>
              ) : null}

              {!loadingList && routines.length === 0 ? (
                <p className="cw-tables-muted">{t("tables.automation.empty")}</p>
              ) : null}

              <ul className="cw-tables-auto-rows">
                {routines.map((routine) => (
                  <li key={routine.id}>
                    <div>
                      <strong>{routine.title || routine.sentence}</strong>
                      <span>{routine.trigger?.human || "—"}</span>
                    </div>
                    <label className="cw-tables-auto-toggle">
                      <input
                        checked={routine.status === "active"}
                        disabled={togglingId === routine.id}
                        onChange={() => void toggleActive(routine)}
                        type="checkbox"
                      />
                      <span>
                        {routine.status === "active"
                          ? t("tables.automation.active")
                          : t("tables.automation.paused")}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {error ? <p className="cw-tables-auto-error">{error}</p> : null}
            </main>
          ) : (
            <main className="do-skill-form cw-tables-auto-create">
              <section>
                <h3>{t("tables.automation.when")}</h3>
                <div className="cw-tables-auto-chips">
                  <button
                    className={triggerKind === "status_changed" ? "is-active" : ""}
                    onClick={() => setTriggerKind("status_changed")}
                    type="button"
                  >
                    {t("tables.automation.trigger.status")}
                  </button>
                  <button
                    className={triggerKind === "record_created" ? "is-active" : ""}
                    onClick={() => setTriggerKind("record_created")}
                    type="button"
                  >
                    {t("tables.automation.trigger.created")}
                  </button>
                  <button
                    className={triggerKind === "date_reached" ? "is-active" : ""}
                    onClick={() => setTriggerKind("date_reached")}
                    type="button"
                  >
                    {t("tables.automation.trigger.date")}
                  </button>
                </div>

                {triggerKind === "status_changed" ? (
                  <label className="cw-tables-auto-field">
                    <span>{t("tables.automation.statusTo")}</span>
                    <select
                      className="cw-tables-select"
                      onChange={(e) => setStatusTo(e.target.value)}
                      value={statusTo}
                    >
                      {options.length === 0 ? (
                        <option value="">{t("tables.automation.noStatuses")}</option>
                      ) : (
                        options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                ) : null}

                {triggerKind === "date_reached" ? (
                  <label className="cw-tables-auto-field">
                    <span>{t("tables.automation.offsetDays")}</span>
                    <input
                      className="cw-tables-input cw-tables-input-num"
                      min={0}
                      onChange={(e) => setOffsetDays(Math.max(0, Number(e.target.value) || 0))}
                      type="number"
                      value={offsetDays}
                    />
                  </label>
                ) : null}
              </section>

              <section>
                <h3>{t("tables.automation.then")}</h3>
                <p className="cw-tables-muted">
                  {t("tables.automation.thenHint").replace("{n}", String(MAX_ACTIONS))}
                </p>
                <div className="cw-tables-auto-chips">
                  {ACTION_CHIPS.map((chip) => (
                    <button
                      className={actions.includes(chip) ? "is-active" : ""}
                      key={chip}
                      onClick={() => toggleAction(chip)}
                      type="button"
                    >
                      {actionLabel(chip)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="cw-tables-auto-sentence">
                <h3>{t("tables.automation.sentence")}</h3>
                <p>{sentence}</p>
              </section>

              {error ? <p className="cw-tables-auto-error">{error}</p> : null}

              <footer className="cw-tables-auto-footer">
                <button
                  className="cw-tables-btn-ghost"
                  onClick={() => {
                    setMode("list");
                    setError("");
                  }}
                  type="button"
                >
                  {t("tables.automation.back")}
                </button>
                <button
                  className="cw-tables-btn"
                  disabled={busy || actions.length === 0}
                  onClick={() => void save()}
                  type="button"
                >
                  {busy ? <Loader2 size={14} className="cw-tables-spin" /> : null}
                  {t("tables.automation.save")}
                </button>
              </footer>
            </main>
          )}
        </div>
      </section>
    </div>
  );
}
