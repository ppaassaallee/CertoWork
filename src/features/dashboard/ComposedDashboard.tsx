import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "../../components/ui/Icon";
import {
  DASHBOARD_WIDGET_CATALOG,
  addDashboardWidget,
  loadDashboardLayout,
  removeDashboardWidget,
  saveDashboardLayout,
  type DashboardLayout,
  type DashboardWidgetKind,
} from "../../lib/dashboardLayout";
import { buildWorkloadRows } from "../../lib/workload";
import { isClosed } from "../../lib/workspaceDisplay";
import { t } from "../../lib/i18n";

export function ComposedDashboard({
  workspaceId,
  tasks,
  projects,
  tables,
  records,
  members,
  approvalCount = 0,
  onOpenWorkload,
  onOpenItem,
  onOpenProject,
}: {
  workspaceId: string;
  tasks: any[];
  projects: any[];
  tables: any[];
  records: any[];
  members: any[];
  approvalCount?: number;
  onOpenWorkload?(): void;
  onOpenItem?(id: string): void;
  onOpenProject?(id: string): void;
}) {
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    loadDashboardLayout(workspaceId),
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setLayout(loadDashboardLayout(workspaceId));
  }, [workspaceId]);

  const persist = (next: DashboardLayout) => {
    setLayout(next);
    saveDashboardLayout(workspaceId, next);
  };

  const openTasks = useMemo(
    () => tasks.filter((task) => !isClosed(task.status)),
    [tasks],
  );
  const overdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return openTasks.filter((task) => {
      const due = String(task.dueDate || task.targetDate || "").slice(0, 10);
      return due && due < today;
    });
  }, [openTasks]);
  const workload = useMemo(
    () => buildWorkloadRows({ tasks: openTasks, projects, members }),
    [openTasks, projects, members],
  );

  const renderWidget = (kind: DashboardWidgetKind) => {
    if (kind === "open_items") {
      return (
        <div>
          <strong className="cw-dash-metric">{openTasks.length}</strong>
          <p>{t("dashboard.widgets.openItemsHint")}</p>
          <ul>
            {openTasks.slice(0, 5).map((task) => (
              <li key={task.id}>
                <button type="button" onClick={() => onOpenItem?.(String(task.id))}>
                  {String(task.title || task.name || task.id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (kind === "overdue") {
      return (
        <div>
          <strong className="cw-dash-metric">{overdue.length}</strong>
          <p>{t("dashboard.widgets.overdueHint")}</p>
        </div>
      );
    }
    if (kind === "projects_health") {
      return (
        <ul>
          {projects.slice(0, 6).map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => onOpenProject?.(String(project.id))}>
                {String(project.title || project.name || project.id)}
              </button>
              <em>{String(project.status || "active")}</em>
            </li>
          ))}
        </ul>
      );
    }
    if (kind === "tables_activity") {
      return (
        <div>
          <strong className="cw-dash-metric">{tables.length}</strong>
          <p>
            {t("dashboard.widgets.tablesHint")
              .replace("{tables}", String(tables.length))
              .replace("{records}", String(records.length))}
          </p>
        </div>
      );
    }
    if (kind === "workload_summary") {
      return (
        <div>
          <p>{t("dashboard.widgets.workloadHint").replace("{n}", String(workload.length))}</p>
          <button type="button" className="cw-tables-btn-ghost" onClick={() => onOpenWorkload?.()}>
            {t("dashboard.openWorkload")}
          </button>
        </div>
      );
    }
    return (
      <div>
        <strong className="cw-dash-metric">{approvalCount}</strong>
        <p>{t("dashboard.widgets.approvalsHint")}</p>
      </div>
    );
  };

  return (
    <div className="cw-dash" data-testid="composed-dashboard">
      <header className="cw-dash-head">
        <div>
          <h1>{t("dashboard.title")}</h1>
          <p className="cw-tables-muted">{t("dashboard.summary")}</p>
        </div>
        <div className="cw-tables-link-menu-wrap">
          <button
            type="button"
            className="cw-tables-btn"
            data-testid="dashboard-add-widget"
            onClick={() => setPickerOpen((v) => !v)}
          >
            <Plus size={14} /> {t("dashboard.addWidget")}
          </button>
          {pickerOpen ? (
            <div className="cw-tables-popover">
              {DASHBOARD_WIDGET_CATALOG.map((row) => (
                <button
                  key={row.kind}
                  type="button"
                  disabled={layout.widgets.some((widget) => widget.kind === row.kind)}
                  onClick={() => {
                    persist(addDashboardWidget(layout, row.kind));
                    setPickerOpen(false);
                  }}
                >
                  {row.title}
                  <em style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                    {row.summary}
                  </em>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="cw-dash-grid">
        {layout.widgets.map((widget) => (
          <article key={widget.id} className="cw-dash-card" data-testid={`dash-widget-${widget.kind}`}>
            <header>
              <strong>{widget.title}</strong>
              <button
                type="button"
                className="cw-tables-icon-btn"
                aria-label={t("dashboard.removeWidget")}
                onClick={() => persist(removeDashboardWidget(layout, widget.id))}
              >
                <X size={14} />
              </button>
            </header>
            {renderWidget(widget.kind)}
          </article>
        ))}
      </div>
    </div>
  );
}
