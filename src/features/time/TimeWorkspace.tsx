import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Clock as Clock3,
  Play,
  Square,
  Plus,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  X,
} from "../../components/ui/Icon";
import { NativeSelect } from "../../components/ui/NativeSelect";
import { localize } from "../../lib/localize";
import { useLocale } from "../../lib/useLocale";
import {
  civilDate,
  csvExport,
  durationLabel,
  parseDuration,
  parsePastedTime,
  shiftDate,
  weekDates,
  type TimeEntry,
  type TimeSheet,
  type TimeTarget,
} from "./model";
import { timeStore, type PageCursor, type Timer } from "../../lib/time/storage";
import "./time.css";
import { TimeInsights } from "./TimeInsights";
import { TimeReportDialog } from "./TimeReportDialog";

type Props = {
  workspaceId: string;
  userId: string;
  projects: TimeTarget[];
  items: TimeTarget[];
  projectId?: string;
  person?: string;
  workspaceName?: string;
  repository?: ReturnType<typeof timeStore>;
};
export default function TimeWorkspace({ workspaceId, userId, projects, items, projectId = "", repository, person, workspaceName }: Props) {
  const locale = useLocale();
  const tr = (en: string, es: string) => localize(locale, en, es);
  const store = useMemo(() => repository || timeStore(workspaceId, userId), [repository, workspaceId, userId]);
  const [anchor, setAnchor] = useState(civilDate);
  const dates = weekDates(anchor);
  const first = dates[0],
    last = dates[6];
  const [rows, setRows] = useState<TimeEntry[]>([]);
  const [sheets, setSheets] = useState<TimeSheet[]>([]);
  const [sheet, setSheet] = useState("all");
  const [selectedProject, setSelectedProject] = useState(projectId);
  const [captureProject, setCaptureProject] = useState(projectId);
  const [cursor, setCursor] = useState<PageCursor>();
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weekReady, setWeekReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState<Timer | null>(null);
  const [now, setNow] = useState(Date.now);
  const [draft, setDraft] = useState<TimeEntry | null>(null);
  const [duration, setDuration] = useState("1:00");
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const fileVersion = useRef(0);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [quickItem, setQuickItem] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const saveKey = useRef("");
  const dialog = useRef<HTMLDialogElement>(null);
  const requestVersion = useRef(0);
  const allSheets = useMemo(() => [{ id: "default", name: localize(locale, "My timesheet", "Mi hoja de horas") }, ...sheets], [sheets, locale]);
  const label = (list: TimeTarget[], id: string) =>
    list.find((row) => row.id === id)?.title ||
    list.find((row) => row.id === id)?.name ||
    tr("Unavailable", "No disponible");
  const fail = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "";
    setError(
      message.includes("timer_running") ? "timer_running" : message.includes("timer_long") ? "timer_long" : "save_load",
    );
  };
  const errorMessage =
    error === "file"
      ? tr(
          "Choose a UTF-8 tab-separated .tsv or .txt file smaller than 100 KB.",
          "Elige un archivo .tsv o .txt UTF-8, separado por tabulaciones, de menos de 100 KB.",
        )
      : error === "paste"
        ? tr(
            "Check the highlighted lines. Use Date, Description and Duration, separated by tabs; up to 50 rows.",
            "Revisa las líneas indicadas. Usa Fecha, Descripción y Duración, separadas por tabulaciones; hasta 50 filas.",
          )
        : error === "timer_running"
          ? tr("A timer is already running. Refresh to see it.", "Ya hay un temporizador activo. Actualiza para verlo.")
          : error === "timer_long"
            ? tr(
                "This timer exceeds 24 hours. Recover it as a manual entry before discarding the timer.",
                "Este temporizador supera las 24 horas. Recupera el tiempo como registro manual antes de descartarlo.",
              )
            : error === "duration"
              ? tr("Use H:MM or decimal hours, from 0:01 to 24:00.", "Usa H:MM u horas decimales, de 0:01 a 24:00.")
              : tr(
                  "Could not save or load your time. Check your connection and permissions, then retry. Nothing was confirmed as saved.",
                  "No se pudieron guardar o cargar las horas. Revisa la conexión y los permisos y reintenta. No se confirmó ningún guardado.",
                );
  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setWeekReady(false);
    setRows([]);
    setMore(false);
    setCursor(undefined);
    try {
      const page = await store.loadWeek(first, last);
      if (version !== requestVersion.current) return;
      setRows(page.rows);
      setCursor(page.cursor);
      setMore(page.more);
      setWeekReady(true);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [store, first, last]);
  useEffect(() => {
    void reload().catch(fail);
    return () => {
      requestVersion.current++;
    };
  }, [reload]);
  useEffect(() => {
    let active = true;
    Promise.all([store.sheets(), store.timer()])
      .then(([nextSheets, running]) => {
        if (active) {
          setSheets(nextSheets);
          setTimer(running);
        }
      })
      .catch((cause) => {
        if (active) fail(cause);
      });
    return () => {
      active = false;
    };
  }, [store]);
  useEffect(() => {
    if (!timer) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timer]);
  useEffect(() => {
    if (!draft && sheetName === null) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previous?.focus();
    };
  }, [Boolean(draft), sheetName !== null]);
  const visible = rows.filter(
    (row) => (sheet === "all" || row.sheetId === sheet) && (!selectedProject || row.projectId === selectedProject),
  );
  const total = visible.reduce((sum, row) => sum + row.minutes, 0);
  const billable = visible.filter((row) => row.billable).reduce((sum, row) => sum + row.minutes, 0);
  const dateLabel = (date: string, weekday = false) =>
    new Intl.DateTimeFormat(locale, {
      ...(weekday ? { weekday: "short" as const } : { month: "short" as const }),
      day: "numeric",
    }).format(new Date(`${date}T12:00:00`));
  const blank = (date = civilDate() >= first && civilDate() <= last ? civilDate() : first): TimeEntry => ({
    id: "",
    workspaceId,
    userId,
    description,
    sheetId: sheet === "all" ? "default" : sheet,
    projectId: captureProject,
    itemId: quickItem,
    minutes: 60,
    date,
    billable: false,
  });
  const edit = (row: TimeEntry) => {
    setPasteMode(false);
    setError("");
    setConfirmDelete(false);
    saveKey.current = row.id || crypto.randomUUID();
    setDuration(durationLabel(row.minutes));
    setDraft(row);
  };
  const applyLocal = (row: TimeEntry) =>
    setRows((previous) =>
      [
        ...previous.filter((value) => value.id !== row.id),
        ...(row.date >= first && row.date <= last ? [row] : []),
      ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    );
  async function perform(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy || readingFile) return;
    if (pasteMode) {
      const parsed = parsePastedTime(pasteText);
      if (!parsed.rows.length || parsed.invalidLines.length) {
        setError("paste");
        return;
      }
      const entries = parsed.rows.map((row, index) => ({
        ...draft,
        ...row,
        id: `${saveKey.current}-${index}`,
      }));
      await perform(async () => {
        await store.saveMany(entries);
        entries.forEach(applyLocal);
        setSavedCount(entries.length);
        setDraft(null);
        setPasteMode(false);
      });
      return;
    }
    const minutes = parseDuration(duration);
    if (!minutes) {
      setError("duration");
      return;
    }
    await perform(async () => {
      const value = { ...draft, id: saveKey.current, minutes };
      await store.save(value);
      applyLocal(value);
      setSavedCount(1);
      setDraft(null);
    });
  }
  async function loadMore() {
    const version = requestVersion.current;
    await perform(async () => {
      const page = await store.loadWeek(first, last, cursor);
      if (version !== requestVersion.current) return;
      setRows((previous) => [...new Map([...previous, ...page.rows].map((row) => [row.id, row])).values()]);
      setCursor(page.cursor);
      setMore(page.more);
    });
  }
  const close = () => {
    fileVersion.current++;
    setReadingFile(false);
    setDraft(null);
    setSheetName(null);
    setPasteMode(false);
  };
  const pasted = parsePastedTime(pasteText);
  return (
    <section className="cw-time" aria-label={tr("Timesheets", "Hojas de horas")}>
      <header className="cw-time-heading">
        <div>
          <span className="cw-time-eyebrow">
            {tr("A clear picture of your work", "Una visión clara de tu trabajo")}
          </span>
          <h1>{projectId ? tr("Project time", "Tiempo del proyecto") : tr("My time", "Mi tiempo")}</h1>
          <p>
            {tr("Track your work. Keep the details connected.", "Registra tu trabajo. Mantén los detalles conectados.")}
          </p>
        </div>
        <Clock3 size={30} aria-hidden="true" />
      </header>
      <p className="cw-time-guide">
        {tr("1. Choose your work", "1. Elige tu trabajo")}
        <span>→</span>
        {tr("2. Track or paste hours", "2. Registra o pega tus horas")}
        <span>→</span>
        {tr("3. Your week updates", "3. Tu semana se actualiza")}
      </p>
      <div className="cw-time-capture">
        <input
          aria-label={tr("What are you working on?", "¿En qué estás trabajando?")}
          placeholder={tr("What are you working on?", "¿En qué estás trabajando?")}
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
        />
        {timer ? (
          <>
            <span role="timer" aria-label={tr("Elapsed time", "Tiempo transcurrido")}>
              {durationLabel(Math.max(0, Math.floor((now - timer.startedAtMs) / 60000)))}:
              {String(Math.max(0, Math.floor((now - timer.startedAtMs) / 1000)) % 60).padStart(2, "0")}{" "}
              <small>{timer.description}</small>
            </span>
            <button
              className="cw-time-primary"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const entry = await store.stop();
                  setTimer(null);
                  if (entry) applyLocal(entry);
                })
              }
            >
              <Square size={15} />
              {tr("Stop", "Detener")}
            </button>
          </>
        ) : (
          <button
            className="cw-time-primary"
            disabled={busy || !description.trim()}
            onClick={() =>
              void perform(async () => {
                const { id: _id, minutes: _minutes, ...value } = blank();
                void _id;
                void _minutes;
                setTimer(await store.start(value));
                setNow(Date.now());
              })
            }
          >
            <Play size={15} />
            {tr("Start timer", "Iniciar temporizador")}
          </button>
        )}
        {!projectId && (
          <NativeSelect
            aria-label={tr("Timer project", "Proyecto del temporizador")}
            value={captureProject}
            disabled={Boolean(timer)}
            onChange={(event) => {
              setCaptureProject(event.target.value);
              setQuickItem("");
            }}
          >
            <option value="">{tr("No project", "Sin proyecto")}</option>
            {projects.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title || row.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          aria-label={tr("Timer item", "Ítem del temporizador")}
          value={quickItem}
          disabled={Boolean(timer)}
          onChange={(event) => setQuickItem(event.target.value)}
        >
          <option value="">{tr("No item", "Sin ítem")}</option>
          {items
            .filter((row) => (row.projectId || "") === captureProject)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.title || row.name}
              </option>
            ))}
        </NativeSelect>
        <button disabled={busy} onClick={() => edit(blank())}>
          <Plus size={16} />
          {tr("Add time", "Registrar tiempo")}
        </button>
      </div>
      {timer && (
        <p className="cw-time-hint">
          {tr(
            "Running timer is saved across tabs and reloads. It keeps its original sheet and project.",
            "El temporizador se conserva entre pestañas y recargas. Mantiene su hoja y proyecto originales.",
          )}{" "}
          {now - timer.startedAtMs > 86400000 && (
            <button
              disabled={busy}
              onClick={() => {
                const { startedAtMs: _start, ...value } = timer;
                void _start;
                edit({ ...value, id: "", minutes: 60 });
              }}
            >
              {tr("Recover manually", "Recuperar manualmente")}
            </button>
          )}
        </p>
      )}
      <div className="cw-time-toolbar">
        <button disabled={busy || loading} onClick={() => setReportOpen(true)}><Download size={15}/>{tr("Export PDF", "Exportar PDF")}</button>
        <label className="cw-time-jump">
          {tr("Week of", "Semana del")}
          <input
            aria-label={tr("Jump to week", "Ir a la semana")}
            type="date"
            value={anchor}
            disabled={loading || busy}
            onChange={(event) => {
              if (event.target.value) setAnchor(event.target.value);
            }}
          />
        </label>
        <button
          disabled={busy}
          onClick={() => {
            edit(blank());
            setPasteText("");
            setPasteMode(true);
          }}
        >
          <Plus size={15} />
          {tr("Paste from Excel", "Pegar desde Excel")}
        </button>
        <div className="cw-time-week">
          <button
            disabled={loading || busy}
            aria-label={tr("Previous week", "Semana anterior")}
            onClick={() => setAnchor(shiftDate(first, -7))}
          >
            <ChevronLeft size={17} />
          </button>
          <strong>
            {dateLabel(first)} – {dateLabel(last)}
          </strong>
          <button
            disabled={loading || busy}
            aria-label={tr("Next week", "Semana siguiente")}
            onClick={() => setAnchor(shiftDate(first, 7))}
          >
            <ChevronRight size={17} />
          </button>
          <button disabled={loading || busy} onClick={() => setAnchor(civilDate())}>
            {tr("This week", "Esta semana")}
          </button>
        </div>
        <label>
          {tr("Sheet", "Hoja")}
          <NativeSelect value={sheet} onChange={(event) => setSheet(event.target.value)}>
            <option value="all">{tr("All my sheets", "Todas mis hojas")}</option>
            {allSheets.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <button disabled={busy || sheets.length >= 99} onClick={() => setSheetName("")}>
          <Plus size={15} />
          {tr("New sheet", "Nueva hoja")}
        </button>
        {!projectId && (
          <label>
            {tr("Project", "Proyecto")}
            <NativeSelect
              value={selectedProject}
              onChange={(event) => {
                setSelectedProject(event.target.value);
                setQuickItem("");
              }}
            >
              <option value="">{tr("All projects", "Todos los proyectos")}</option>
              {projects.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title || row.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <button
          disabled={loading || busy}
          aria-label={tr("Refresh", "Actualizar")}
          onClick={() =>
            void perform(async () => {
              await reload();
              setTimer(await store.timer());
            })
          }
        >
          <RefreshCw size={16} />
        </button>
        <button
          disabled={loading || !weekReady || more || !visible.length}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob(
                [
                  "\uFEFF",
                  csvExport(visible, (row) => [
                    row.projectId ? label(projects, row.projectId) : "",
                    row.itemId ? label(items, row.itemId) : "",
                    allSheets.find((value) => value.id === row.sheetId)?.name || "",
                  ]),
                ],
                { type: "text/csv;charset=utf-8" },
              ),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = `timesheet-${first}.csv`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={15} />
          {tr("Export CSV", "Exportar CSV")}
        </button>
      </div>
      <p className="cw-time-hint">
        {tr("Timer sheet", "Hoja del temporizador")}:{" "}
        {allSheets.find((row) => row.id === (sheet === "all" ? "default" : sheet))?.name}.{" "}
        {tr(
          "Timers round up to the next minute. Manual durations are stored in whole minutes.",
          "Los temporizadores redondean al minuto siguiente. Las duraciones manuales se guardan en minutos enteros.",
        )}
      </p>
      {busy && !draft && sheetName === null && <p role="status">{tr("Saving…", "Guardando…")}</p>}
      {!draft && sheetName === null && error && (
        <p className="cw-time-error" role="alert">
          {errorMessage}
        </p>
      )}
      {savedCount > 0 && !error && (
        <p role="status" className="cw-time-saved">
          ✓ {savedCount} {tr("entries saved", "registros guardados")}
        </p>
      )}
      <div className="cw-time-summary">
        <div>
          <small>
            {tr("Week total", "Total semanal")}
            {more ? " *" : ""}
          </small>
          <strong>{weekReady ? durationLabel(total) : "—"}</strong>
        </div>
        <div>
          <small>{tr("Billable", "Facturable")}</small>
          <strong>{weekReady ? durationLabel(billable) : "—"}</strong>
        </div>
        <p>
          {tr(
            "Only your time is shown. Entries never grant access to projects or private items.",
            "Solo se muestran tus horas. Los registros no conceden acceso a proyectos ni ítems privados.",
          )}
        </p>
      </div>
      <TimeInsights
        entries={visible}
        dates={dates}
        projects={projects}
        partial={more}
        ready={weekReady}
        onDay={(date) => edit(blank(date))}
      />
      <div className="cw-time-grid" aria-busy={loading}>
        <table>
          <caption className="sr-only">
            {tr(
              "Weekly timesheet; select a duration to edit an entry",
              "Hoja semanal; selecciona una duración para editar el registro",
            )}
          </caption>
          <thead>
            <tr>
              <th>{tr("Activity / project / item", "Actividad / proyecto / ítem")}</th>
              {dates.map((date) => (
                <th key={date} className={date === civilDate() ? "is-today" : ""}>
                  {dateLabel(date, true)}
                </th>
              ))}
              <th>{tr("Total", "Total")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <strong>{row.description}</strong>
                  <small>
                    {row.projectId ? label(projects, row.projectId) : tr("No project", "Sin proyecto")}
                    {row.itemId ? ` / ${label(items, row.itemId)}` : ""} ·{" "}
                    {allSheets.find((value) => value.id === row.sheetId)?.name || tr("Sheet", "Hoja")}
                    {row.billable ? ` · ${tr("Billable", "Facturable")}` : ""}
                  </small>
                </th>
                {dates.map((date) => (
                  <td key={date}>
                    {date === row.date ? (
                      <button
                        disabled={busy}
                        aria-label={`${tr("Edit time", "Editar horas")}: ${row.description}, ${date}`}
                        onClick={() => edit(row)}
                      >
                        {durationLabel(row.minutes)}
                      </button>
                    ) : (
                      <span aria-hidden="true">—</span>
                    )}
                  </td>
                ))}
                <td>{durationLabel(row.minutes)}</td>
              </tr>
            ))}
            {!loading && weekReady && !visible.length && (
              <tr>
                <td colSpan={9}>
                  <div className="cw-time-empty">
                    <Clock3 size={27} />
                    <h2>{tr("Your week starts here", "Tu semana empieza aquí")}</h2>
                    <p>
                      {tr(
                        "Start a timer or add time to a project, an item, or independent work.",
                        "Inicia un temporizador o registra horas en un proyecto, un ítem o trabajo independiente.",
                      )}
                    </p>
                    <button onClick={() => edit(blank())}>
                      {tr("Add your first entry", "Añade tu primer registro")}
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={9} role="status">
                  {tr("Loading your week…", "Cargando tu semana…")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th>{tr("Daily total", "Total diario")}</th>
              {dates.map((date) => (
                <td key={date}>
                  {durationLabel(visible.filter((row) => row.date === date).reduce((sum, row) => sum + row.minutes, 0))}
                </td>
              ))}
              <td>{durationLabel(total)}</td>
            </tr>
            <tr>
              <th>{tr("Add an entry", "Añadir registro")}</th>
              {dates.map((date) => (
                <td key={date}>
                  <button
                    disabled={busy}
                    aria-label={`${tr("Add time", "Registrar tiempo")} ${date}`}
                    onClick={() => edit(blank(date))}
                  >
                    +
                  </button>
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {more && (
        <p className="cw-time-hint">
          {tr(
            "Partial totals — more entries are available. Load all pages before exporting.",
            "Totales parciales: hay más registros. Carga todas las páginas antes de exportar.",
          )}{" "}
          <button disabled={busy || loading} onClick={() => void loadMore()}>
            {tr("Load more", "Cargar más")}
          </button>
        </p>
      )}
      {timer && now - timer.startedAtMs > 86400000 && (
        <div>
          {confirmDiscard && (
            <p role="alert">
              {tr(
                "First save the time you need manually. Discard cannot be undone.",
                "Guarda primero las horas necesarias. Descartar no se puede deshacer.",
              )}
            </p>
          )}
          <button
            disabled={busy}
            onClick={() => {
              if (!confirmDiscard) setConfirmDiscard(true);
              else
                void perform(async () => {
                  await store.discardTimer();
                  setTimer(null);
                  setConfirmDiscard(false);
                });
            }}
          >
            {confirmDiscard
              ? tr("Confirm discard", "Confirmar descarte")
              : tr("Discard recovered timer", "Descartar temporizador recuperado")}
          </button>
          {confirmDiscard && <button onClick={() => setConfirmDiscard(false)}>{tr("Cancel", "Cancelar")}</button>}
        </div>
      )}
      <dialog
        className="cw-time-dialog"
        aria-labelledby="cw-time-dialog-title"
        ref={dialog}
        onKeyDown={event => {
          if (event.key !== "Tab") return;
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']")].filter(control => control.getClientRects().length > 0);
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <header>
          <h2 id="cw-time-dialog-title">
            {sheetName !== null
              ? tr("New timesheet", "Nueva hoja de horas")
              : pasteMode
                ? tr("Paste your timesheet", "Pega tu hoja de horas")
                : draft?.id
                  ? tr("Edit time", "Editar horas")
                  : tr("Add time", "Registrar tiempo")}
          </h2>
          <button aria-label={tr("Close", "Cerrar")} onClick={close}>
            <X size={18} />
          </button>
        </header>
        {sheetName !== null ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                const id = await store.addSheet(sheetName);
                setSheets((previous) => [...previous, { id, name: sheetName.trim() }]);
                setSheet(id);
                setSheetName(null);
              });
            }}
          >
            <label>
              {tr("Sheet name", "Nombre de la hoja")}
              <input
                autoFocus
                required
                maxLength={80}
                value={sheetName}
                onChange={(event) => setSheetName(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="cw-time-error">
                {errorMessage}
              </p>
            )}
            <footer>
              <button type="button" disabled={busy} onClick={close}>
                {tr("Cancel", "Cancelar")}
              </button>
              <button className="cw-time-primary" disabled={busy || !sheetName.trim()}>
                {tr("Create sheet", "Crear hoja")}
              </button>
            </footer>
          </form>
        ) : (
          draft && (
            <form onSubmit={(event) => void save(event)}>
              {pasteMode ? (
                <div className="cw-time-paste">
                  <label>
                    {tr("Or upload a tab-separated file", "O carga un archivo separado por tabulaciones")}
                    <input
                      type="file"
                      accept=".tsv,.txt,text/tab-separated-values,text/plain"
                      disabled={busy}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const version = ++fileVersion.current;
                        setPasteText("");
                        if (file.size > 100000 || !/\.(tsv|txt)$/i.test(file.name)) {
                          setError("file");
                          return;
                        }
                        setReadingFile(true);
                        setError("");
                        try {
                          const value = await file.text();
                          if (fileVersion.current === version) setPasteText(value.replace(/^\uFEFF/, ""));
                        } catch {
                          if (fileVersion.current === version) setError("file");
                        } finally {
                          if (fileVersion.current === version) setReadingFile(false);
                        }
                      }}
                    />
                  </label>
                  {readingFile && <p role="status">{tr("Reading file…", "Leyendo archivo…")}</p>}
                  <p>
                    {tr(
                      "Copy three columns from Excel: date (YYYY-MM-DD), description and hours (H:MM or decimal). No header row. All rows use the project, item and sheet selected below.",
                      "Copia tres columnas de Excel: fecha (AAAA-MM-DD), descripción y horas (H:MM o decimal). Sin encabezados. Todas las filas usan el proyecto, ítem y hoja seleccionados abajo.",
                    )}
                  </p>
                  <label>
                    {tr("Paste rows", "Pegar filas")}
                    <textarea
                      aria-label={tr("Paste rows", "Pegar filas")}
                      autoFocus
                      value={pasteText}
                      onChange={(event) => {
                        setPasteText(event.target.value);
                        setError("");
                      }}
                      placeholder={`${civilDate()}\tDesign review\t1:30`}
                      maxLength={100000}
                    />
                  </label>
                  <div role="status">
                    {pasted.rows.length} {tr("valid rows", "filas válidas")} ·{" "}
                    {durationLabel(pasted.rows.reduce((sum, row) => sum + row.minutes, 0))}
                  </div>
                  {pasted.invalidLines.length > 0 && (
                    <p className="cw-time-error">
                      {tr("Check lines", "Revisa las líneas")}: {pasted.invalidLines.join(", ")}
                    </p>
                  )}
                  {pasted.rows.length > 0 && (
                    <div className="cw-time-paste-preview">
                      <table>
                        <caption>{tr("Review before saving", "Revisa antes de guardar")}</caption>
                        <thead>
                          <tr>
                            <th>{tr("Date", "Fecha")}</th>
                            <th>{tr("Description", "Descripción")}</th>
                            <th>{tr("Hours", "Horas")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pasted.rows.map((row, index) => (
                            <tr key={index}>
                              <td>{row.date}</td>
                              <td>{row.description}</td>
                              <td>{durationLabel(row.minutes)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <label>
                    {tr("Description", "Descripción")}
                    <textarea
                      autoFocus
                      required
                      maxLength={2000}
                      value={draft.description}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    />
                  </label>
                  <div className="cw-time-fields">
                    <label>
                      {tr("Date", "Fecha")}
                      <input
                        required
                        type="date"
                        value={draft.date}
                        onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                      />
                    </label>
                    <label>
                      {tr("Duration (H:MM or hours)", "Duración (H:MM u horas)")}
                      <input
                        required
                        inputMode="decimal"
                        value={duration}
                        onChange={(event) => setDuration(event.target.value)}
                        placeholder="1:30"
                      />
                    </label>
                  </div>
                </>
              )}
              <label>
                {tr("Sheet", "Hoja")}
                <NativeSelect
                  value={draft.sheetId}
                  onChange={(event) => setDraft({ ...draft, sheetId: event.target.value })}
                >
                  {allSheets.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label>
                {tr("Project", "Proyecto")}
                <NativeSelect
                  value={draft.projectId}
                  disabled={Boolean(projectId)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      projectId: event.target.value,
                      itemId: "",
                    })
                  }
                >
                  <option value="">{tr("No project", "Sin proyecto")}</option>
                  {projects.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.title || row.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label>
                {tr("Linked item (any type)", "Ítem vinculado (cualquier tipo)")}
                <NativeSelect
                  value={draft.itemId}
                  onChange={(event) => setDraft({ ...draft, itemId: event.target.value })}
                >
                  <option value="">{tr("No item", "Sin ítem")}</option>
                  {items
                    .filter((row) => (row.projectId || "") === draft.projectId)
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title || row.name}
                      </option>
                    ))}
                </NativeSelect>
              </label>
              <label className="cw-time-check">
                <input
                  type="checkbox"
                  checked={draft.billable}
                  onChange={(event) => setDraft({ ...draft, billable: event.target.checked })}
                />
                {tr("Billable time", "Tiempo facturable")}
              </label>
              {error && (
                <p role="alert" className="cw-time-error">
                  {errorMessage}
                </p>
              )}
              {confirmDelete && (
                <p role="alert">
                  {tr(
                    "Delete this time entry permanently? This cannot be undone.",
                    "¿Eliminar este registro permanentemente? No se puede deshacer.",
                  )}
                </p>
              )}
              <footer>
                {draft.id && (
                  <button
                    className="cw-time-danger"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!confirmDelete) setConfirmDelete(true);
                      else
                        void perform(async () => {
                          await store.remove(draft.id);
                          setRows((previous) => previous.filter((row) => row.id !== draft.id));
                          setDraft(null);
                        });
                    }}
                  >
                    {confirmDelete
                      ? tr("Confirm deletion", "Confirmar eliminación")
                      : tr("Delete entry", "Eliminar registro")}
                  </button>
                )}
                <button type="button" disabled={busy} onClick={close}>
                  {tr("Cancel", "Cancelar")}
                </button>
                <button
                  className="cw-time-primary"
                  disabled={
                    busy ||
                    readingFile ||
                    confirmDelete ||
                    (pasteMode && (!pasted.rows.length || pasted.invalidLines.length > 0))
                  }
                >
                  {busy
                    ? tr("Saving…", "Guardando…")
                    : pasteMode
                      ? tr("Save entries", "Guardar registros")
                      : tr("Save time", "Guardar horas")}
                </button>
              </footer>
            </form>
          )
        )}
      </dialog>
      {reportOpen && <TimeReportDialog workspaceId={workspaceId} userId={userId} from={first} to={last} initialSheetId={sheet} projectId={selectedProject} sheets={allSheets} projects={projects} items={items} store={store} person={person} workspace={workspaceName} onClose={() => setReportOpen(false)}/>}
    </section>
  );
}
