import type { RitualCardProps } from "./types";

export function MetricStripCard({ prepared, locale = "es" }: RitualCardProps) {
  const metrics = (prepared.metrics || {}) as {
    planned?: number;
    done?: number;
    undone?: number;
    blocked?: number;
  };
  const planned = Number(metrics.planned || 0);
  const done = Number(metrics.done || 0);
  const pct = planned ? Math.round((done / planned) * 100) : 0;
  const delta = done - planned;

  return (
    <div className="cw-ritual-metrics" data-testid="card-metric-strip">
      <div>
        <b>{planned}</b>
        <span>{locale === "es" ? "planeados" : "planned"}</span>
      </div>
      <div>
        <b>{done}</b>
        <span>{locale === "es" ? "hechos" : "done"}</span>
      </div>
      <div>
        <b>{pct}%</b>
        <span>{locale === "es" ? "cumplimiento" : "hit rate"}</span>
      </div>
      <div className={delta < 0 ? "is-danger" : ""}>
        <b>
          {delta > 0 ? "+" : ""}
          {delta}
        </b>
        <span>delta</span>
      </div>
    </div>
  );
}
