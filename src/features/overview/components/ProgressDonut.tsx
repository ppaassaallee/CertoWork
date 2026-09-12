import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { OverviewProgress } from "../useOverviewData";

const COLORS = {
  completed: "var(--status-success)",
  inProgress: "var(--status-info)",
  overdue: "var(--status-danger)",
  pending: "var(--status-neutral-soft)",
};

export function ProgressDonut({
  progress,
  animate = true,
}: {
  progress: OverviewProgress;
  animate?: boolean;
}) {
  const data = useMemo(() => {
    const rows = [
      { key: "completed", name: "Completados", value: progress.completed, color: COLORS.completed },
      { key: "inProgress", name: "En curso", value: progress.inProgress, color: COLORS.inProgress },
      { key: "overdue", name: "Atrasados", value: progress.overdue, color: COLORS.overdue },
      { key: "pending", name: "Pendientes", value: Math.max(0, progress.pending), color: COLORS.pending },
    ].filter((row) => row.value > 0);
    if (!rows.length) {
      return [{ key: "empty", name: "Vacío", value: 1, color: "var(--border)" }];
    }
    return rows;
  }, [progress]);

  const total =
    progress.completed + progress.inProgress + progress.overdue + Math.max(0, progress.pending);

  return (
    <div className="cw-overview-donut" data-testid="overview-progress-donut">
      <div className="cw-overview-donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              cx="50%"
              cy="50%"
              data={data}
              dataKey="value"
              endAngle={-270}
              innerRadius="60%"
              isAnimationActive={animate}
              outerRadius="88%"
              paddingAngle={1}
              startAngle={90}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="cw-overview-donut-center">
          <strong className="tabular-nums">{progress.pct}%</strong>
        </div>
      </div>
      <ul className="cw-overview-donut-legend">
        <li>
          <i style={{ background: COLORS.completed }} /> Completados{" "}
          <b className="tabular-nums">{progress.completed}</b>
        </li>
        <li>
          <i style={{ background: COLORS.inProgress }} /> En curso{" "}
          <b className="tabular-nums">{progress.inProgress}</b>
        </li>
        <li>
          <i style={{ background: COLORS.overdue }} /> Atrasados{" "}
          <b className="tabular-nums">{progress.overdue}</b>
        </li>
        <li>
          <i style={{ background: COLORS.pending }} /> Pendientes{" "}
          <b className="tabular-nums">{Math.max(0, progress.pending)}</b>
        </li>
      </ul>
      {total === 0 ? <p className="cw-overview-muted">Sin ítems todavía</p> : null}
    </div>
  );
}
