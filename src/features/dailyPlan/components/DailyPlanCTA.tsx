import { BUCKETS, BUCKET_ORDER } from "../buckets";
import type { PlanBucket } from "../types";

export function DailyPlanCTA({ onPlan }: { onPlan: () => void }) {
  return (
    <div className="dp-cta" data-testid="daily-plan-cta">
      <button className="dp-cta-btn" onClick={onPlan} type="button">
        Plan today · 5 min
      </button>
      <p className="dp-cta-hint">Triage into Fires, Growth, and Extras. Your list stays as-is.</p>
    </div>
  );
}

export function BucketPickMenu({
  onPick,
  onClose,
}: {
  onPick: (bucket: PlanBucket) => void;
  onClose?: () => void;
}) {
  return (
    <div className="dp-bucket-menu" data-testid="daily-plan-bucket-menu" role="menu">
      {BUCKET_ORDER.map((key) => {
        const bucket = BUCKETS[key];
        return (
          <button
            key={key}
            onClick={() => {
              onPick(key);
              onClose?.();
            }}
            role="menuitem"
            style={{ color: bucket.fg }}
            type="button"
          >
            {bucket.label}
          </button>
        );
      })}
    </div>
  );
}
