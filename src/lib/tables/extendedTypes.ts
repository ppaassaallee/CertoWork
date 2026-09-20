import type { SoftTint } from "./types";

export type { SoftTint, ColumnSummary, ColumnConfig, TableGroup, TablePermissions } from "./types";

export function defaultGroups() {
  return [{ id: "g-default", name: "Main", color: "#2547C4", order: 0 }];
}

export function softTintToCss(tint: SoftTint): { bg: string; fg: string } {
  const map: Record<SoftTint, { bg: string; fg: string }> = {
    gray: { bg: "rgba(107,114,128,.12)", fg: "#374151" },
    blue: { bg: "rgba(37,71,196,.12)", fg: "#1E3A8A" },
    green: { bg: "rgba(58,174,108,.14)", fg: "#166534" },
    yellow: { bg: "rgba(234,179,8,.16)", fg: "#854D0E" },
    orange: { bg: "rgba(242,98,15,.14)", fg: "#9A3412" },
    red: { bg: "rgba(192,57,43,.12)", fg: "#991B1B" },
    purple: { bg: "rgba(124,58,237,.12)", fg: "#5B21B6" },
    teal: { bg: "rgba(20,184,166,.14)", fg: "#115E59" },
  };
  return map[tint] || map.gray;
}
