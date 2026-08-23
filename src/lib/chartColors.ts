/** Notion tag palette — the only raw colors charts/canvas/export code may use. */
export const CHART_COLORS = [
  "#2383e2",
  "#1c7a52",
  "#9f6b00",
  "#c4554d",
  "#9065b0",
  "#d9730d",
] as const;

export const chartColors = CHART_COLORS;

export const STATUS_CHART = {
  success: "#1c7a52",
  warning: "#9f6b00",
  danger: "#c4554d",
} as const;

export const NOTION_COLORS = {
  ink: "#37352f",
  secondary: "#787774",
  muted: "#9b9a97",
  surface: "#ffffff",
  surfaceSubtle: "#f7f7f5",
  border: "#e9e9e7",
  accent: "#2383e2",
  accentSoft: "#e7f3f8",
  success: "#1c7a52",
  successSoft: "#dbeddb",
  warning: "#9f6b00",
  warningSoft: "#fdecc8",
  danger: "#c4554d",
  dangerSoft: "#ffe2dd",
} as const;

/** CSS variables embedded in standalone print windows. */
export const PRINT_THEME_CSS = `:root{
  --surface-0:${NOTION_COLORS.surface};
  --surface-1:${NOTION_COLORS.surfaceSubtle};
  --border:${NOTION_COLORS.border};
  --text-primary:${NOTION_COLORS.ink};
  --text-secondary:${NOTION_COLORS.secondary};
  --text-muted:${NOTION_COLORS.muted};
  --accent:${NOTION_COLORS.accent};
  --status-success:${NOTION_COLORS.success};
  --status-success-soft:${NOTION_COLORS.successSoft};
  --status-warning:${NOTION_COLORS.warning};
  --status-warning-soft:${NOTION_COLORS.warningSoft};
  --status-danger:${NOTION_COLORS.danger};
  --status-danger-soft:${NOTION_COLORS.dangerSoft};
}`;

export const healthChartColors = {
  green: "var(--status-green)",
  amber: "var(--status-amber)",
  red: "var(--status-red)",
  blue: "var(--status-blue)",
  gray: "var(--status-gray)",
} as const;

export const healthChartHex = {
  green: NOTION_COLORS.success,
  amber: NOTION_COLORS.warning,
  red: NOTION_COLORS.danger,
  blue: NOTION_COLORS.accent,
  gray: NOTION_COLORS.muted,
} as const;
