import { useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import {
  enableBilling,
  enableCollab,
  enableDailyBrief,
  enableTables,
  useBillingEnabled,
  useCollabEnabled,
  useDailyBriefEnabled,
  useTablesEnabled,
} from "../flags/featureUserFlags";
import { enableDailyPlan, useDailyPlanEnabled } from "../dailyPlan";

type FlagRow = {
  id: string;
  title: string;
  where: string;
  enabled: boolean;
  onEnable: () => Promise<void>;
};

/** One-tap toggles for Tables / Brief / Billing / Daily Plan / Collab. */
export function FeatureLabsPanel({
  onOpen,
}: {
  onOpen?: (path: string) => void;
}) {
  const { user } = useAuth();
  const tablesOn = useTablesEnabled();
  const briefOn = useDailyBriefEnabled();
  const billingOn = useBillingEnabled();
  const dailyPlanOn = useDailyPlanEnabled();
  const collabOn = useCollabEnabled();
  const [busy, setBusy] = useState<string | null>(null);

  if (!user?.uid) return null;

  const rows: FlagRow[] = [
    {
      id: "tables",
      title: "Tables",
      where: "Sidebar → Tables · /tables · templates & Odysseus builder",
      enabled: tablesOn,
      onEnable: () => enableTables(user.uid),
    },
    {
      id: "brief",
      title: "Daily Brief",
      where: "Home (template brief + Odysseus signals) · flags.dailyBrief",
      enabled: briefOn,
      onEnable: () => enableDailyBrief(user.uid),
    },
    {
      id: "billing",
      title: "Billing",
      where: "/billing · Desktop rail · project ?project= filter",
      enabled: billingOn,
      onEnable: () => enableBilling(user.uid),
    },
    {
      id: "dailyPlan",
      title: "Daily Plan",
      where: "My Work → Try Daily Plan (Fires / Growth / Extras)",
      enabled: dailyPlanOn,
      onEnable: () => enableDailyPlan(user.uid),
    },
    {
      id: "collab",
      title: "Collab",
      where: "/collab · native conversations · flags.collab",
      enabled: collabOn,
      onEnable: () => enableCollab(user.uid),
    },
  ];

  const openPath = (id: string) => {
    if (id === "tables") return "/tables";
    if (id === "brief") return "/home";
    if (id === "billing") return "/billing";
    if (id === "collab") return "/collab";
    return "/my-work";
  };

  return (
    <section className="do-workspace-admin-card" data-testid="feature-labs-panel">
      <div className="do-workspace-admin-head">
        <span className="do-kicker">Labs</span>
        <strong>Feature flags</strong>
      </div>
      <p className="do-panel-intro">
        Turn on shipped modules for this account. Also works via{" "}
        <code>localStorage</code> keys <code>certoTables</code>,{" "}
        <code>certoDailyBrief</code>, <code>certoBilling</code>,{" "}
        <code>certoDailyPlan</code>, <code>certoCollab</code> (=1).
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <li
            key={row.id}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              borderTop: "1px solid var(--border, #e5e7eb)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block" }}>{row.title}</strong>
              <span className="do-panel-intro" style={{ margin: 0, display: "block" }}>
                {row.where}
              </span>
            </div>
            {row.enabled ? (
              <button
                className="do-button"
                onClick={() => onOpen?.(openPath(row.id))}
                type="button"
              >
                Open
              </button>
            ) : (
              <button
                className="do-button"
                disabled={busy === row.id}
                onClick={() => {
                  setBusy(row.id);
                  void row.onEnable().finally(() => setBusy(null));
                }}
                type="button"
              >
                {busy === row.id ? "…" : "Enable"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
