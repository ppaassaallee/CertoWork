import { useState } from "react";
import { useAuth } from "../../../lib/AuthContext";
import { enableDailyPlan } from "../useDailyPlanEnabled";

/** Shown on My Work when Daily Plan is off — one tap to turn it on. */
export function DailyPlanOptIn({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user?.uid) return null;

  return (
    <div className={`dp-optin${compact ? " is-compact" : ""}`} data-testid="daily-plan-optin">
      <div className="dp-optin-copy">
        <strong>Plan your day</strong>
        <span>Fires · Growth · Extras — 5 minutes to clear the noise.</span>
      </div>
      <button
        className="dp-cta-btn"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void enableDailyPlan(user.uid).finally(() => setBusy(false));
        }}
        type="button"
      >
        {busy ? "Turning on…" : "Try Daily Plan"}
      </button>
    </div>
  );
}
