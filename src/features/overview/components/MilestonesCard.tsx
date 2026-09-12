import type { OverviewMilestone } from "../useOverviewData";

const CHIP_CLASS: Record<OverviewMilestone["chip"], string> = {
  "On track": "is-success",
  "At risk": "is-warning",
  Blocked: "is-danger",
  Pendiente: "is-neutral",
};

function monthDay(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
  };
}

export function MilestonesCard({
  milestones,
  onSeeAll,
  title = "Próximos hitos",
}: {
  milestones: OverviewMilestone[];
  onSeeAll?: () => void;
  title?: string;
}) {
  if (!milestones.length) return null;

  return (
    <section className="cw-overview-card" data-testid="overview-milestones-card">
      <header className="cw-overview-card-head">
        <h3>{title}</h3>
        {onSeeAll ? (
          <button className="cw-overview-link" onClick={onSeeAll} type="button">
            Ver todos
          </button>
        ) : null}
      </header>
      <ul className="cw-overview-milestones">
        {milestones.map((item) => {
          const { month, day } = monthDay(item.dueIso);
          return (
            <li key={item.id}>
              <div className="cw-overview-milestone-date">
                <span>{month}</span>
                <strong className="tabular-nums">{day}</strong>
              </div>
              <div className="cw-overview-milestone-body">
                <strong>{item.title}</strong>
                <small>{item.stageLabel}</small>
              </div>
              <span className={`cw-overview-chip ${CHIP_CLASS[item.chip]}`}>
                {item.chip}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
