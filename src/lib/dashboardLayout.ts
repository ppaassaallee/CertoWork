export type DashboardWidgetKind =
  | "open_items"
  | "overdue"
  | "projects_health"
  | "tables_activity"
  | "workload_summary"
  | "approvals";

export type DashboardWidget = {
  id: string;
  kind: DashboardWidgetKind;
  title: string;
};

export type DashboardLayout = {
  widgets: DashboardWidget[];
  updatedAt: string;
};

const STORAGE_PREFIX = "certo.dashboard.layout.";

export const DASHBOARD_WIDGET_CATALOG: Array<{
  kind: DashboardWidgetKind;
  title: string;
  summary: string;
}> = [
  { kind: "open_items", title: "Open items", summary: "Active work across projects" },
  { kind: "overdue", title: "Overdue", summary: "Past-due items needing attention" },
  { kind: "projects_health", title: "Projects", summary: "Portfolio health snapshot" },
  { kind: "tables_activity", title: "Tables", summary: "Records across workspace tables" },
  { kind: "workload_summary", title: "Workload", summary: "Assignee load this week" },
  { kind: "approvals", title: "Approvals", summary: "Pending review queue" },
];

export function defaultDashboardLayout(): DashboardLayout {
  return {
    updatedAt: new Date().toISOString(),
    widgets: DASHBOARD_WIDGET_CATALOG.slice(0, 4).map((row) => ({
      id: `${row.kind}_${Math.random().toString(36).slice(2, 7)}`,
      kind: row.kind,
      title: row.title,
    })),
  };
}

export function loadDashboardLayout(workspaceId: string): DashboardLayout {
  if (typeof window === "undefined") return defaultDashboardLayout();
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${workspaceId}`);
    if (!raw) return defaultDashboardLayout();
    const parsed = JSON.parse(raw) as DashboardLayout;
    if (!Array.isArray(parsed.widgets)) return defaultDashboardLayout();
    return parsed;
  } catch {
    return defaultDashboardLayout();
  }
}

export function saveDashboardLayout(workspaceId: string, layout: DashboardLayout) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${STORAGE_PREFIX}${workspaceId}`,
    JSON.stringify({ ...layout, updatedAt: new Date().toISOString() }),
  );
}

export function addDashboardWidget(
  layout: DashboardLayout,
  kind: DashboardWidgetKind,
): DashboardLayout {
  const catalog = DASHBOARD_WIDGET_CATALOG.find((row) => row.kind === kind);
  if (!catalog) return layout;
  if (layout.widgets.some((widget) => widget.kind === kind)) return layout;
  return {
    ...layout,
    widgets: [
      ...layout.widgets,
      {
        id: `${kind}_${Math.random().toString(36).slice(2, 7)}`,
        kind,
        title: catalog.title,
      },
    ],
  };
}

export function removeDashboardWidget(layout: DashboardLayout, widgetId: string): DashboardLayout {
  return {
    ...layout,
    widgets: layout.widgets.filter((widget) => widget.id !== widgetId),
  };
}
