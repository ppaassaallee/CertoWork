import { useEffect, useMemo, useRef, useState } from "react";
import { Download, X } from "../../components/ui/Icon";
import { NativeSelect } from "../../components/ui/NativeSelect";
import { useLocale } from "../../lib/useLocale";
import { localize } from "../../lib/localize";
import { type timeStore, type PageCursor } from "../../lib/time/storage";
import { buildTimeReport, loadTimeReport, validReportRange, type ReportLabels, type TimeReportOptions } from "./report";
import { durationLabel, type TimeEntry } from "./model";

type Props = Omit<ReportLabels, "locale"> & {
  workspaceId: string;
  userId: string;
  from: string;
  to: string;
  initialSheetId: string;
  projectId: string;
  store: Pick<ReturnType<typeof timeStore>, "loadWeek">;
  onClose: () => void;
};
export function TimeReportDialog(props: Props) {
  const locale = useLocale();
  const tr = (en: string, es: string) => localize(locale, en, es);
  const [options, setOptions] = useState<TimeReportOptions>(() => ({
    from: props.from,
    to: props.to,
    sheetIds: props.initialSheetId === "all" ? props.sheets.map((row) => row.id) : [props.initialSheetId],
    projectId: props.projectId,
    billableOnly: false,
  }));
  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(new Date());
  const version = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      version.current++;
      dialog.current?.close();
      previous?.focus();
    };
  }, []);
  const update = (patch: Partial<TimeReportOptions>) => {
    version.current++;
    setOptions((previous) => ({ ...previous, ...patch }));
    setEntries(null);
    setBusy(false);
    setReady(false);
    setError("");
  };
  const valid = validReportRange(options.from, options.to) && options.sheetIds.length > 0;
  const html = useMemo(
    () => (entries ? buildTimeReport(entries, options, { ...props, locale }, generatedAt) : ""),
    [entries, options, locale, generatedAt, props.person, props.workspace, props.sheets, props.projects, props.items],
  );
  useEffect(() => {
    setReady(false);
  }, [html]);
  async function prepare() {
    const request = ++version.current;
    setBusy(true);
    setError("");
    setCount(0);
    setReady(false);
    setEntries(null);
    try {
      const result = await loadTimeReport<PageCursor>(
        options,
        props,
        (from, to, cursor) => props.store.loadWeek(from, to, cursor, true),
        () => version.current !== request,
        (scanned) => {
          if (version.current === request) setCount(scanned);
        },
      );
      if (version.current !== request) return;
      if (!result.length) {
        setError("empty");
        return;
      }
      setGeneratedAt(new Date());
      setEntries(result);
    } catch (cause) {
      if (version.current === request)
        setError(cause instanceof Error && cause.message === "report_large" ? "large" : "load");
    } finally {
      if (version.current === request) setBusy(false);
    }
  }
  const errorText =
    error === "print"
      ? tr(
          "Your browser could not open printing. Try saving the PDF from a desktop browser.",
          "El navegador no pudo abrir la impresión. Intenta guardar el PDF desde un navegador de escritorio.",
        )
      : error === "empty"
        ? tr(
            "No saved entries match these dates, sheets and filters.",
            "No hay registros guardados para estas fechas, hojas y filtros.",
          )
        : error === "large"
          ? tr(
              "This range reaches the 2,000-entry safety limit. Choose a shorter date range; no partial report was generated.",
              "El rango alcanza el límite de seguridad de 2.000 registros. Elige menos fechas; no se generó un reporte parcial.",
            )
          : tr(
              "Could not prepare the report. Check your connection and permissions, then retry. No partial PDF was generated.",
              "No se pudo preparar el reporte. Revisa la conexión y los permisos y reintenta. No se generó un PDF parcial.",
            );
  return (
    <dialog
      ref={dialog}
      className={`cw-time-dialog cw-time-report-dialog${entries ? " is-preview" : ""}`}
      aria-labelledby="cw-time-report-title"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
          ),
        ].filter((control) => control.getClientRects().length > 0);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header>
        <div>
          <span className="cw-time-eyebrow">CERTO WORK</span>
          <h2 id="cw-time-report-title">{tr("Export timesheet to PDF", "Exportar hoja de horas a PDF")}</h2>
        </div>
        <button onClick={props.onClose} aria-label={tr("Close", "Cerrar")}>
          <X size={18} />
        </button>
      </header>
      <p className="cw-time-report-help">
        {tr(
          "Choose your sheets and dates, review the report, then save as PDF using your browser. Your time stays on your device during PDF generation.",
          "Elige las hojas y fechas, revisa el reporte y guárdalo como PDF desde tu navegador. La generación del PDF se realiza en tu dispositivo.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !busy) void prepare();
        }}
      >
        <div className="cw-time-fields">
          <label>
            {tr("From", "Desde")}
            <input
              type="date"
              required
              value={options.from}
              onChange={(event) => update({ from: event.target.value })}
            />
          </label>
          <label>
            {tr("To", "Hasta")}
            <input type="date" required value={options.to} onChange={(event) => update({ to: event.target.value })} />
          </label>
        </div>
        <fieldset className="cw-time-report-sheets">
          <legend>{tr("Include sheets", "Incluir hojas")}</legend>
          <div>
            <button type="button" onClick={() => update({ sheetIds: props.sheets.map((row) => row.id) })}>
              {tr("Select all", "Seleccionar todas")}
            </button>
            <button type="button" onClick={() => update({ sheetIds: [] })}>
              {tr("Clear selection", "Limpiar selección")}
            </button>
          </div>
          {props.sheets.map((sheet) => (
            <label key={sheet.id}>
              <input
                type="checkbox"
                checked={options.sheetIds.includes(sheet.id)}
                onChange={(event) =>
                  update({
                    sheetIds: event.target.checked
                      ? [...options.sheetIds, sheet.id]
                      : options.sheetIds.filter((id) => id !== sheet.id),
                  })
                }
              />
              {sheet.name}
            </label>
          ))}
        </fieldset>
        <div className="cw-time-fields">
          <label>
            {tr("Project", "Proyecto")}
            <NativeSelect value={options.projectId} onChange={(event) => update({ projectId: event.target.value })}>
              <option value="">{tr("All projects", "Todos los proyectos")}</option>
              {props.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title || project.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="cw-time-check">
            <input
              type="checkbox"
              checked={options.billableOnly}
              onChange={(event) => update({ billableOnly: event.target.checked })}
            />
            {tr("Billable only", "Solo facturable")}
          </label>
        </div>
        {!valid && (
          <p role="status" className="cw-time-hint">
            {tr(
              "Select at least one sheet and a valid date range of up to 366 days.",
              "Selecciona al menos una hoja y un rango válido de hasta 366 días.",
            )}
          </p>
        )}
        {busy && (
          <p role="status">
            {tr("Preparing saved entries…", "Preparando registros guardados…")} {count}
          </p>
        )}
        {error && (
          <p role="alert" className="cw-time-error">
            {errorText}
          </p>
        )}
        <footer>
          <button type="button" onClick={props.onClose}>
            {tr("Cancel", "Cancelar")}
          </button>
          <button className="cw-time-primary" disabled={busy || !valid}>
            {tr("Preview report", "Ver reporte")}
          </button>
        </footer>
      </form>
      {entries && (
        <section className="cw-time-report-preview" aria-label={tr("Report preview", "Vista previa del reporte")}>
          <div className="cw-time-report-summary">
            <span>
              {entries.length} {tr("entries", "registros")} ·{" "}
              {durationLabel(entries.reduce((sum, row) => sum + row.minutes, 0))}
            </span>
            <button
              className="cw-time-primary"
              disabled={!ready}
              onClick={(event) => {
                const trigger = event.currentTarget;
                try {
                  frame.current?.contentWindow?.focus();
                  frame.current?.contentWindow?.print();
                } catch {
                  setError("print");
                } finally {
                  trigger.focus();
                }
              }}
            >
              <Download size={15} />
              {tr("Save PDF", "Guardar PDF")}
            </button>
          </div>
          <p className="cw-time-hint">
            {tr(
              "In the print dialog, select Save as PDF. Only saved entries are included, not active timers. Browser print controls may vary by device.",
              "En el diálogo de impresión, elige Guardar como PDF. Solo se incluyen registros guardados, no temporizadores activos. Las opciones pueden variar según el dispositivo.",
            )}
          </p>
          <iframe
            ref={frame}
            title={tr("Printable timesheet", "Hoja de horas para imprimir")}
            srcDoc={html}
            sandbox="allow-modals allow-same-origin"
            onLoad={() => setReady(true)}
          />
        </section>
      )}
    </dialog>
  );
}
