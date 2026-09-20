import { useEffect, useState } from "react";
import { useAuth } from "../../../lib/AuthContext";
import { getTodayKey, getWeekKeys, labelForKey } from "../dateKeys";
import { getPlansInRange } from "../dayPlanService";
import type { DayPlan } from "../types";

export function WeekStrip({
  todayKey,
  activeKey,
  planRevision,
  onSelectDay,
}: {
  todayKey: string;
  activeKey: string;
  /** Refresh when today's plan changes */
  planRevision?: string | number | null;
  onSelectDay: (dateKey: string) => void;
}) {
  const { user } = useAuth();
  const weekKeys = getWeekKeys(todayKey);
  const [plans, setPlans] = useState<DayPlan[]>([]);

  useEffect(() => {
    if (!user?.uid) {
      setPlans([]);
      return;
    }
    let cancelled = false;
    void getPlansInRange(user.uid, weekKeys[0], weekKeys[6]).then((rows) => {
      if (!cancelled) setPlans(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, weekKeys[0], weekKeys[6], planRevision]);

  const byDate = new Map(plans.map((p) => [p.date, p]));

  return (
    <div className="dp-week-strip" data-testid="daily-plan-week-strip" role="tablist">
      {weekKeys.map((key) => {
        const plan = byDate.get(key);
        const planned = plan?.entries.length || 0;
        const done = plan?.entries.filter((e) => e.doneToday).length || 0;
        const isToday = key === todayKey;
        const isPast = key < todayKey;
        const isFuture = key > todayKey;
        let caption = "";
        if (plan?.focusScore != null && isPast) {
          caption = String(plan.focusScore);
        } else if (plan && isPast) caption = `${done}/${planned}`;
        else if (plan && isFuture) caption = String(planned);
        else if (plan && isToday) caption = planned ? `${done}/${planned}` : "";
        return (
          <button
            aria-selected={key === activeKey}
            className={`dp-week-day ${isToday ? "is-today" : ""} ${key === activeKey ? "is-active" : ""}`}
            key={key}
            onClick={() => onSelectDay(key)}
            role="tab"
            type="button"
          >
            <span className="dp-week-wd">
              {labelForKey(key, getTodayKey()).slice(0, 3).toUpperCase()}
            </span>
            <span className="dp-week-num">{Number(key.slice(8))}</span>
            {caption ? (
              <span className={`dp-week-cap ${plan?.focusScore != null && isPast ? "dp-focus-ring" : ""}`}>
                {caption}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
