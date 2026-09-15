import { useMemo } from "react";
import { buildWorkloadRows } from "../../lib/workload";
import { t } from "../../lib/i18n";

export function WorkloadView({
  tasks,
  projects,
  members,
  onOpenItem,
}: {
  tasks: any[];
  projects: any[];
  members: any[];
  onOpenItem?(id: string): void;
}) {
  const rows = useMemo(
    () =>
      buildWorkloadRows({
        tasks,
        projects,
        members,
        capacityHoursPerPerson: 40,
      }),
    [tasks, projects, members],
  );

  return (
    <div className="cw-workload" data-testid="workload-view">
      <header className="cw-workload-head">
        <div>
          <h1>{t("workload.title")}</h1>
          <p className="cw-tables-muted">{t("workload.summary")}</p>
        </div>
      </header>
      {!rows.length ? (
        <p className="cw-tables-muted">{t("workload.empty")}</p>
      ) : (
        <ul className="cw-workload-list">
          {rows.map((row) => {
            const pct = Math.min(100, Math.round(row.loadRatio * 100));
            const tone =
              row.loadRatio >= 1.1 ? "danger" : row.loadRatio >= 0.85 ? "warning" : "success";
            return (
              <li key={row.assigneeId} data-testid={`workload-row-${row.assigneeId}`}>
                <div className="cw-workload-row-head">
                  <strong>{row.assigneeName}</strong>
                  <span>
                    {row.itemCount} {t("workload.items")} · {row.estimateHours}h /{" "}
                    {row.capacityHours}h
                    {row.overdueCount
                      ? ` · ${row.overdueCount} ${t("workload.overdue")}`
                      : ""}
                  </span>
                </div>
                <div className={`cw-workload-bar cw-tables-tone-${tone}`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <ul className="cw-workload-items">
                  {row.items.slice(0, 8).map((item) => (
                    <li key={`${row.assigneeId}-${item.id}`}>
                      <button type="button" onClick={() => onOpenItem?.(item.id)}>
                        <strong>{item.title}</strong>
                        <em>
                          {item.projectTitle || t("workload.general")} · {item.dueDate || "—"}
                          {item.estimateHours ? ` · ${item.estimateHours}h` : ""}
                        </em>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
