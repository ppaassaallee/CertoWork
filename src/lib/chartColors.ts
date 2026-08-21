/** Categorical chart palette — never use inline hex in chart components. */
export const chartColors = [
  "#2563EB",
  "#0F766E",
  "#7C3AED",
  "#DB2777",
  "#0EA5E9",
  "#4B5563",
] as const;

export const healthChartColors = {
  green: "var(--status-green)",
  amber: "var(--status-amber)",
  red: "var(--status-red)",
  blue: "var(--status-blue)",
  gray: "var(--status-gray)",
} as const;

export const healthChartHex = {
  green: "#16A34A",
  amber: "#F59E0B",
  red: "#DC2626",
  blue: "#2563EB",
  gray: "#9CA3AF",
} as const;
