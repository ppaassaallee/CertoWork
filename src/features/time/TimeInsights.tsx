import { useLocale } from "../../lib/useLocale";
import { localize } from "../../lib/localize";
import { analyzeTime, durationLabel, type TimeEntry, type TimeTarget } from "./model";

export function TimeInsights({
  entries,
  dates,
  projects,
  partial,
  ready,
  onDay,
}: {
  entries: TimeEntry[];
  dates: string[];
  projects: TimeTarget[];
  partial: boolean;
  ready: boolean;
  onDay: (date: string) => void;
}) {
  const locale = useLocale();
  const tr = (en: string, es: string) => localize(locale, en, es);
  const data = analyzeTime(entries, dates);
  const peak = Math.max(...data.daily.map((row) => row.minutes), 60);
  const total = entries.reduce((sum, row) => sum + row.minutes, 0);
  const palette = ["#18786e", "#688db9", "#b58c55", "#9d82b1", "#7f9d78"];
  const grouped =
    data.projects.length > 5
      ? [
          ...data.projects.slice(0, 4),
          {
            projectId: "__other__",
            minutes: data.projects.slice(4).reduce((sum, row) => sum + row.minutes, 0),
          },
        ]
      : data.projects;
  return (
    <div className="cw-time-insights" aria-label={tr("Time insights", "Análisis de horas")}>
      <section className="cw-time-chart">
        <div className="cw-time-chart-title">
          <h2>{tr("Your week, at a glance", "Tu semana, de un vistazo")}</h2>
          <small>
            {partial
              ? tr("Partial data", "Datos parciales")
              : tr("Select a day to add time", "Elige un día para registrar horas")}
          </small>
        </div>
        <div className="cw-time-bars">
          {data.daily.map((row) => (
            <button
              key={row.date}
              disabled={!ready}
              onClick={() => onDay(row.date)}
              aria-label={`${tr("Add time", "Registrar tiempo")} ${row.date}; ${durationLabel(row.minutes)}`}
            >
              <strong>{ready ? durationLabel(row.minutes) : "—"}</strong>
              <span className="cw-time-bar-track">
                <span
                  style={{
                    height: `${Math.max(row.minutes ? 5 : 0, (row.minutes / peak) * 100)}%`,
                  }}
                />
              </span>
              <small>
                {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(`${row.date}T12:00:00`))}
              </small>
            </button>
          ))}
        </div>
      </section>
      <section className="cw-time-chart">
        <div className="cw-time-chart-title">
          <h2>{tr("Where your time goes", "En qué inviertes tu tiempo")}</h2>
          <small>{tr("By project", "Por proyecto")}</small>
        </div>
        <div className="cw-time-distribution" aria-hidden="true">
          {grouped.map((row, index) => (
            <span
              key={row.projectId}
              style={{
                width: `${total ? (row.minutes / total) * 100 : 0}%`,
                background: palette[index % palette.length],
              }}
            />
          ))}
        </div>
        {grouped.length ? (
          <ul className="cw-time-legend">
            {grouped.map((row, index) => (
              <li key={row.projectId}>
                <span className="cw-time-dot" style={{ background: palette[index % palette.length] }} />
                <span>
                  {row.projectId === "__other__"
                    ? tr("Other projects", "Otros proyectos")
                    : row.projectId
                      ? projects.find((project) => project.id === row.projectId)?.title ||
                        projects.find((project) => project.id === row.projectId)?.name ||
                        tr("Unavailable project", "Proyecto no disponible")
                      : tr("Independent work", "Trabajo independiente")}
                </span>
                <strong>{durationLabel(row.minutes)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cw-time-chart-empty">
            {tr(
              "Add your first entry to see your work take shape.",
              "Registra tus primeras horas para ver cómo se distribuye tu trabajo.",
            )}
          </p>
        )}
      </section>
    </div>
  );
}
