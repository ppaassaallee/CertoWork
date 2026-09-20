import { useMemo } from "react";
import { DButton, DStatCard } from "../../desktop/ui";
import { useDailyBriefEnabled } from "../flags/featureUserFlags";
import type { Brief } from "../brief/types";
import "../brief/brief.css";

/** Compact phone card for the Daily Brief when the flag is on. */
export function PhoneDailyBriefCard({
  brief,
  onRefresh,
  onOpenFull,
}: {
  brief: Brief | null;
  onRefresh?: () => void;
  onOpenFull?: () => void;
}) {
  const enabled = useDailyBriefEnabled();
  const headline = useMemo(
    () => (brief ? brief.headline.parts.map((p) => p.text).join("") : ""),
    [brief],
  );
  if (!enabled) return null;
  return (
    <section className="brief-card" data-testid="phone-daily-brief" style={{ marginBottom: 12 }}>
      <div className="brief-card-head">
        <span className="brief-date">Daily brief</span>
        <button className="brief-refresh" onClick={onRefresh} type="button">
          Refresh
        </button>
      </div>
      <p className="brief-headline" style={{ fontSize: 18 }}>
        {headline || "Your brief will appear here."}
      </p>
      {brief?.summary ? <p className="brief-summary">{brief.summary}</p> : null}
      {brief?.stats?.length ? (
        <div className="brief-stats" style={{ marginTop: 12 }}>
          {brief.stats.slice(0, 4).map((s) => (
            <DStatCard bad={s.tone === "bad"} key={s.key} label={s.label} value={s.value} />
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 10 }}>
        <DButton onClick={onOpenFull} size="sm" variant="secondary">
          Open Home brief
        </DButton>
      </div>
    </section>
  );
}
