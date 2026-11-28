import { civilDate, durationLabel, type TimeEntry, type TimeSheet, type TimeTarget } from "./model";

export type TimeReportOptions = {
  from: string;
  to: string;
  sheetIds: string[];
  projectId: string;
  billableOnly: boolean;
};
export type ReportLabels = {
  locale: "en" | "es";
  person?: string;
  workspace?: string;
  sheets: TimeSheet[];
  projects: TimeTarget[];
  items: TimeTarget[];
};
export const MAX_REPORT_ROWS = 2000;
export function validReportRange(from: string, to: string) {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && civilDate(new Date(`${date}T12:00:00`)) === date;
  return (
    valid(from) &&
    valid(to) &&
    from <= to &&
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 < 366
  );
}
export async function loadTimeReport<Cursor>(
  options: TimeReportOptions,
  identity: { workspaceId: string; userId: string },
  load: (from: string, to: string, cursor?: Cursor) => Promise<{ rows: TimeEntry[]; more: boolean; cursor?: Cursor }>,
  cancelled: () => boolean,
  progress: (count: number) => void,
) {
  if (!validReportRange(options.from, options.to) || !options.sheetIds.length) throw new Error("report_range");
  const all = new Map<string, TimeEntry>();
  let scanned = 0;
  let cursor: Cursor | undefined;
  let hasMore = true;
  do {
    if (cancelled()) throw new Error("report_cancelled");
    const page = await load(options.from, options.to, cursor);
    if (cancelled()) throw new Error("report_cancelled");
    scanned += page.rows.length;
    if (page.more && page.rows.length === 0) throw new Error("report_page");
    if (scanned > MAX_REPORT_ROWS) throw new Error("report_large");
    for (const row of page.rows) {
      if (row.workspaceId !== identity.workspaceId || row.userId !== identity.userId)
        throw new Error("report_identity");
      if (
        row.date >= options.from &&
        row.date <= options.to &&
        options.sheetIds.includes(row.sheetId) &&
        (!options.projectId || options.projectId === row.projectId) &&
        (!options.billableOnly || row.billable)
      )
        all.set(row.id, row);
    }
    progress(scanned);
    hasMore = page.more;
    if (!hasMore) break;
    if (page.cursor === undefined || page.cursor === cursor) throw new Error("report_page");
    if (scanned >= MAX_REPORT_ROWS) throw new Error("report_large");
    cursor = page.cursor;
  } while (hasMore);
  return [...all.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description) || a.id.localeCompare(b.id),
  );
}
export const escapeReportText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function buildTimeReport(
  entries: TimeEntry[],
  options: TimeReportOptions,
  labels: ReportLabels,
  generatedAt = new Date(),
): string {
  if (!validReportRange(options.from, options.to)) throw new Error("report_range");
  const tr = (en: string, es: string) => ({ en, es })[labels.locale];
  const text = escapeReportText;
  const dateFormat = new Intl.DateTimeFormat(labels.locale, { day: "numeric", month: "short", year: "numeric" });
  const date = (value: string) => dateFormat.format(new Date(`${value}T12:00:00`));
  const name = (list: TimeTarget[], id: string, fallback: string) =>
    list.find((row) => row.id === id)?.title || list.find((row) => row.id === id)?.name || fallback;
  const total = entries.reduce((sum, row) => sum + row.minutes, 0);
  const billable = entries.filter((row) => row.billable).reduce((sum, row) => sum + row.minutes, 0);
  const percent = total ? Math.round((billable / total) * 100) : 0;
  const grouped = new Map<string, number>();
  const dayTotals = new Map<string, number>();
  entries.forEach((row) => {
    grouped.set(row.projectId, (grouped.get(row.projectId) || 0) + row.minutes);
    dayTotals.set(row.date, (dayTotals.get(row.date) || 0) + row.minutes);
  });
  const projectRows = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  const sheets = labels.sheets
    .filter((sheet) => options.sheetIds.includes(sheet.id))
    .map((sheet) => sheet.name)
    .join(", ");
  const body = entries
    .map((row, index) => {
      const previous = entries[index - 1];
      const next = entries[index + 1];
      const dayStart = previous?.date !== row.date;
      const dayEnd = next?.date !== row.date;
      const dayTotal = dayTotals.get(row.date) || 0;
      const context = [
        row.projectId
          ? name(labels.projects, row.projectId, tr("Unavailable project", "Proyecto no disponible"))
          : tr("Independent work", "Trabajo independiente"),
        row.itemId ? name(labels.items, row.itemId, tr("Unavailable item", "Ítem no disponible")) : "",
        labels.sheets.find((sheet) => sheet.id === row.sheetId)?.name || tr("Sheet", "Hoja"),
      ]
        .filter(Boolean)
        .join(" / ");
      return `${dayStart ? `<tr class="day"><th colspan="3">${text(date(row.date))}</th></tr>` : ""}<tr><td><div class="description">${text(row.description)}</div><small>${text(context)}</small></td><td class="kind">${row.billable ? tr("Billable", "Facturable") : tr("Non-billable", "No facturable")}</td><td class="hours">${durationLabel(row.minutes)}</td></tr>${dayEnd ? `<tr class="subtotal"><td colspan="2">${tr("Daily total", "Total diario")}</td><td class="hours">${durationLabel(dayTotal)}</td></tr>` : ""}`;
    })
    .join("");
  return `<!doctype html><html lang="${labels.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>Certo-timesheet-${options.from}-${options.to}</title><style>
@page{size:A4;margin:16mm 15mm 19mm;@bottom-left{content:"Certo Work";font:9px Arial;color:#6a7875}@bottom-right{content:counter(page) " / " counter(pages);font:9px Arial;color:#6a7875}}
*{box-sizing:border-box}html{background:#eef2f0}body{margin:0 auto;padding:42px;max-width:900px;background:#fff;color:#243b35;font:12px/1.5 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}header{border-top:5px solid #18786e;padding-top:22px;margin-bottom:24px}.brand{font-size:10px;letter-spacing:2px;color:#18786e;font-weight:700}h1{font-size:32px;letter-spacing:-1px;margin:10px 0 0}h2{font-size:13px;margin:0 0 12px}p{margin:5px 0}.owner{font-size:16px;font-weight:600}.period{font-size:15px;color:#516b62}.scope{color:#6a7875;overflow-wrap:anywhere;font-size:11px}.summary{display:table;table-layout:fixed;width:100%;border-collapse:separate;border-spacing:8px 0;margin:20px -8px}.card{display:table-cell;background:#f2f7f5;border:1px solid #e4ece8;border-radius:10px;padding:15px}.card small{display:block;color:#5b7268}.card strong{font-size:26px;letter-spacing:-1px;font-variant-numeric:tabular-nums}.analysis{display:table;width:100%;table-layout:fixed;margin:22px 0;break-inside:avoid}.analysis>section{display:table-cell;width:50%;padding:16px;border:1px solid #e0e8e4;vertical-align:top}.analysis>section:first-child{border-radius:10px 0 0 10px}.analysis>section:last-child{border-radius:0 10px 10px 0;border-left:0}.meter{height:10px;background:#e5ede9;border-radius:5px;overflow:hidden;margin:12px 0}.meter span{display:block;height:100%;background:#18786e}.project{display:table;width:100%;font-size:11px;margin:9px 0}.project span{display:table-cell;overflow-wrap:anywhere;padding-right:12px}.project strong{display:table-cell;text-align:right;width:50px;white-space:nowrap}.extra{font-size:10px;color:#6a7875}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:15px}thead{display:table-header-group}thead th{text-align:left;padding:10px;background:#18786e;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.6px}thead th:nth-child(2){width:100px}thead th:last-child{width:62px;text-align:right}td{padding:10px;border-bottom:1px solid #e5ebe8;vertical-align:top}tr{break-inside:avoid}.day th{text-align:left;background:#f1f6f3;color:#3c6251;padding:8px 10px;font-size:11px}.description{white-space:pre-wrap;overflow-wrap:anywhere;font-weight:500}td small{display:block;color:#6a7875;font-size:10px;line-height:1.5;margin-top:4px;overflow-wrap:anywhere}.hours{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:600}.kind{font-size:10px;color:#597264}.subtotal td{font-size:10px;background:#f8faf9;padding-top:6px;padding-bottom:6px;font-weight:600}footer{margin-top:24px;border-top:1px solid #d8e4dd;padding-top:12px;color:#6a7875;font-size:10px;break-inside:avoid}.final{font-weight:700;font-size:14px;margin-top:18px;text-align:right}@media print{html{background:white}body{max-width:none;padding:0;font-size:11px}.card{padding:12px}.card strong{font-size:24px}header{margin-bottom:18px}.summary,.analysis{break-inside:avoid}a{color:inherit;text-decoration:none}}
</style></head><body><header><div class="brand">CERTO WORK / ${tr("TIME REPORT", "REPORTE DE HORAS")}</div><h1>${tr("Timesheet", "Hoja de horas")}</h1><p class="owner">${text(labels.person || tr("Personal timesheet", "Hoja personal"))}</p><p class="period">${text(date(options.from))} - ${text(date(options.to))}</p><p class="scope">${text([labels.workspace, sheets, options.projectId ? name(labels.projects, options.projectId, tr("Project", "Proyecto")) : tr("All projects", "Todos los proyectos"), options.billableOnly ? tr("Billable only", "Solo facturable") : ""].filter(Boolean).join(" / "))}</p></header>
<div class="summary"><div class="card"><small>${tr("TOTAL HOURS", "HORAS TOTALES")}</small><strong>${durationLabel(total)}</strong></div><div class="card"><small>${tr("BILLABLE", "FACTURABLE")}</small><strong>${durationLabel(billable)}</strong></div><div class="card"><small>${tr("ENTRIES", "REGISTROS")}</small><strong>${entries.length}</strong></div></div>
<div class="analysis"><section><h2>${tr("Billable distribution", "Distribución facturable")}</h2><strong>${percent}%</strong> ${tr("of recorded time", "del tiempo registrado")}<div class="meter"><span style="width:${percent}%"></span></div><p class="extra">${tr("Non-billable", "No facturable")}: ${durationLabel(total - billable)}</p></section><section><h2>${tr("Time by project", "Horas por proyecto")}</h2>${projectRows
    .slice(0, 5)
    .map(
      ([id, minutes]) =>
        `<div class="project"><span>${text(id ? name(labels.projects, id, tr("Unavailable project", "Proyecto no disponible")) : tr("Independent work", "Trabajo independiente"))}</span><strong>${durationLabel(minutes)}</strong></div>`,
    )
    .join(
      "",
    )}${projectRows.length > 5 ? `<p class="extra">${tr("Other projects", "Otros proyectos")}: ${durationLabel(projectRows.slice(5).reduce((sum, row) => sum + row[1], 0))}</p>` : ""}</section></div>
<h2>${tr("Activity detail", "Detalle de actividades")}</h2><table><thead><tr><th>${tr("Work / project / item", "Trabajo / proyecto / ítem")}</th><th>${tr("Type", "Tipo")}</th><th>${tr("Hours", "Horas")}</th></tr></thead><tbody>${body}</tbody></table><p class="final">${tr("Total", "Total")}: ${durationLabel(total)}</p><footer><p>${tr("Generated", "Generado")}: ${text(new Intl.DateTimeFormat(labels.locale, { dateStyle: "medium", timeStyle: "short" }).format(generatedAt))}</p><p>${tr("Saved entries only. Active timers and unsaved changes are not included. This report is not an invoice or an approval.", "Solo registros guardados. No incluye temporizadores activos ni cambios sin guardar. Este reporte no es una factura ni una aprobación.")}</p></footer></body></html>`;
}
