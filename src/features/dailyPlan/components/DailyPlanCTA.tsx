import { BUCKETS, BUCKET_ORDER } from "../buckets";
import type { PlanBucket } from "../types";

export function DailyPlanCTA({ onPlan }: { onPlan: () => void }) {
  return (
    <div className="dp-cta" data-testid="daily-plan-cta">
      <p className="dp-cta-hint">
        Nothing planned for today yet.
        <br />
        <span style={{ fontSize: 11.5, color: "var(--dp-ink-3)" }}>
          Empty state — only shown when nothing is planned
        </span>
      </p>
      <button className="dp-cta-btn" onClick={onPlan} type="button">
        Plan today · 5 min
      </button>
    </div>
  );
}

export function BucketPickMenu({
  onPick,
  onClose,
  label = "Add to",
}: {
  onPick: (bucket: PlanBucket) => void;
  onClose?: () => void;
  label?: string;
}) {
  return (
    <div className="dp-pop" data-testid="daily-plan-bucket-menu" role="menu">
      <span className="lbl">{label}</span>
      {BUCKET_ORDER.map((key) => {
        const bucket = BUCKETS[key];
        const short = key === "fire" ? "f" : key === "growth" ? "g" : "e";
        return (
          <button
            className={short}
            data-bucket={key}
            key={key}
            onClick={() => {
              onPick(key);
              onClose?.();
            }}
            role="menuitem"
            type="button"
          >
            {bucket.label}
          </button>
        );
      })}
    </div>
  );
}
