import type { OverviewKpi } from "../useOverviewData";

const TONE_STYLES: Record<
  OverviewKpi["tone"],
  { bg: string; fg: string }
> = {
  info: { bg: "var(--status-info-soft)", fg: "var(--status-info)" },
  neutral: { bg: "var(--status-neutral-soft)", fg: "var(--text-primary)" },
  success: { bg: "var(--status-success-soft)", fg: "var(--status-success)" },
  danger: { bg: "var(--status-danger-soft)", fg: "var(--status-danger)" },
  warning: { bg: "var(--status-warning-soft)", fg: "var(--status-warning)" },
};

export function KpiTile({
  kpi,
  onClick,
}: {
  kpi: OverviewKpi;
  onClick?: () => void;
}) {
  const tone = TONE_STYLES[kpi.tone];
  const interactive = Boolean(onClick);
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      className={`cw-overview-kpi${interactive ? " is-clickable" : ""}`}
      onClick={onClick}
      style={{ background: tone.bg, color: tone.fg }}
      type={interactive ? "button" : undefined}
    >
      <span className="cw-overview-kpi-label">{kpi.label}</span>
      <strong className="cw-overview-kpi-value tabular-nums">{kpi.value}</strong>
      {kpi.subtitle ? (
        <span className="cw-overview-kpi-sub">{kpi.subtitle}</span>
      ) : null}
    </Tag>
  );
}
