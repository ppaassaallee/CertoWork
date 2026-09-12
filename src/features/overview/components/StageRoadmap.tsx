import { Check, Flag } from "../../../components/ui/Icon";
import {
  STAGE_COLOR_VAR,
  STAGE_SOFT_VAR,
  type OverviewRoadmapRow,
} from "../useOverviewData";
import type { DeliveryStage } from "../../../lib/projectDelivery";

function pctAlong(iso: string, startIso: string, endIso: string) {
  const start = new Date(`${startIso}T12:00:00`).getTime();
  const end = new Date(`${endIso}T12:00:00`).getTime();
  const t = new Date(`${iso}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100));
}

function tickLabels(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T12:00:00`).getTime();
  const end = new Date(`${endIso}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [startIso, endIso].filter(Boolean);
  }
  return [0, 1 / 3, 2 / 3, 1].map((frac) => {
    const d = new Date(start + (end - start) * frac);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

function formatSpan(start: string | null, end: string | null, progress: number | null) {
  const parts: string[] = [];
  if (start && end) {
    const a = new Date(`${start}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const b = new Date(`${end}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    parts.push(`${a} – ${b}`);
  }
  if (progress != null) parts.push(`${progress}%`);
  return parts.join(" · ");
}

export function StageRoadmap({
  rows,
  rangeStartIso,
  rangeEndIso,
  todayIso,
  onOpenGantt,
  empty,
  onOpenList,
  leftLabel = "Etapa",
}: {
  rows: OverviewRoadmapRow[] | Array<{
    stage: DeliveryStage;
    label: string;
    startIso?: string | null;
    endIso?: string | null;
    progressPct?: number | null;
    bars: OverviewRoadmapRow["bars"];
  }>;
  rangeStartIso: string | null;
  rangeEndIso: string | null;
  todayIso: string;
  onOpenGantt?: () => void;
  empty?: boolean;
  onOpenList?: () => void;
  leftLabel?: string;
}) {
  const start = rangeStartIso || todayIso;
  const end = rangeEndIso || todayIso;
  const ticks = tickLabels(start, end);
  const todayLeft = pctAlong(todayIso, start, end);

  if (empty) {
    return (
      <section className="cw-overview-card cw-overview-roadmap" data-testid="overview-roadmap">
        <header className="cw-overview-card-head">
          <h3>Roadmap por etapa</h3>
        </header>
        <p className="cw-overview-empty-line">
          Sin ítems con fechas todavía
          {onOpenList ? (
            <>
              {" · "}
              <button className="cw-overview-link" onClick={onOpenList} type="button">
                Ir a Tabla
              </button>
            </>
          ) : null}
        </p>
      </section>
    );
  }

  return (
    <section className="cw-overview-card cw-overview-roadmap" data-testid="overview-roadmap">
      <header className="cw-overview-card-head">
        <h3>Roadmap por etapa</h3>
        {onOpenGantt ? (
          <button className="cw-overview-link" onClick={onOpenGantt} type="button">
            Ver Gantt
          </button>
        ) : null}
      </header>
      <div className="cw-overview-roadmap-axis" aria-hidden="true">
        <span className="cw-overview-roadmap-axis-spacer">{leftLabel}</span>
        <div className="cw-overview-roadmap-ticks">
          {ticks.map((tick, index) => (
            <span key={`${tick}-${index}`}>{tick}</span>
          ))}
        </div>
      </div>
      <div className="cw-overview-roadmap-rows">
        {rows.map((row) => {
          const color = STAGE_COLOR_VAR[row.stage];
          const soft = STAGE_SOFT_VAR[row.stage];
          return (
            <div className="cw-overview-roadmap-row" key={row.stage + row.label}>
              <div className="cw-overview-roadmap-meta">
                <div className="cw-overview-roadmap-name">
                  <i style={{ background: color }} />
                  <span>{row.label}</span>
                </div>
                <small>
                  {formatSpan(
                    row.startIso ?? null,
                    row.endIso ?? null,
                    row.progressPct ?? null,
                  ) || "—"}
                </small>
                {row.progressPct != null ? (
                  <span className="cw-overview-roadmap-progress">
                    <i style={{ width: `${row.progressPct}%`, background: color }} />
                  </span>
                ) : null}
              </div>
              <div className="cw-overview-roadmap-track">
                <span
                  className="cw-overview-today-line"
                  style={{ left: `${todayLeft}%` }}
                />
                {row.bars.map((bar) => {
                  const left = pctAlong(bar.startIso, start, end);
                  const right = pctAlong(bar.endIso, start, end);
                  const width = Math.max(2, right - left);
                  return (
                    <div
                      className={`cw-overview-bar${bar.done ? " is-done" : ""}${bar.isMilestone ? " is-milestone" : ""}`}
                      key={bar.id}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: soft,
                        color,
                      }}
                      title={`${bar.label} ${bar.startIso} – ${bar.endIso}`}
                    >
                      {bar.isMilestone ? <Flag size={11} /> : bar.done ? <Check size={11} /> : null}
                      <span className="cw-overview-bar-label">{bar.label}</span>
                      <small>
                        {bar.startIso.slice(5)}–{bar.endIso.slice(5)}
                      </small>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
