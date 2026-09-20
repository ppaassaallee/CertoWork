import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMobileHeader } from "../MobileChromeContext";
import { MButton, MChip, MEmpty, MListRow, MSegmented, MSheet } from "../ui";
import {
  enableDailyPlan,
  useDailyPlanEnabled,
} from "../../features/dailyPlan";
import { useAuth } from "../../lib/AuthContext";
import type { ReactNode } from "react";

type Seg = "today" | "items" | "events";

export function PhoneMyWork({
  listRenderer,
  dailyPlanSlot,
  itemCount,
  overdueCount,
}: {
  /** Existing My Work list (Asana surface) — used in My items segment */
  listRenderer: () => ReactNode;
  /** Full DailyPlanOverlay when flag on; otherwise opt-in empty */
  dailyPlanSlot?: ReactNode;
  itemCount: number;
  overdueCount: number;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const dailyOn = useDailyPlanEnabled();
  const initial: Seg =
    params.get("view") === "today" || params.get("view") === "events"
      ? (params.get("view") as Seg)
      : dailyOn
        ? "today"
        : "items";
  const [seg, setSeg] = useState<Seg>(initial);
  const [moreOpen, setMoreOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useMobileHeader({
    title: "My Work",
    actions: undefined,
  });

  useEffect(() => {
    const v = params.get("view");
    if (v === "today" || v === "events" || v === "items") setSeg(v);
  }, [params]);

  const segments = useMemo(
    () => [
      { id: "today", label: "Today" },
      { id: "items", label: "My items" },
      { id: "events", label: "Events" },
    ],
    [],
  );

  return (
    <div className="m-phone-pad" data-testid="phone-my-work">
      <MSegmented
        onChange={(id) => {
          setSeg(id as Seg);
          navigate(`/my-work?view=${id}`, { replace: true });
        }}
        options={segments}
        value={seg}
      />

      {seg === "items" ? (
        <>
          <div className="m-chip-row">
            <MChip chevron onClick={() => setMoreOpen(true)}>
              View
            </MChip>
            <MChip chevron onClick={() => setFilterOpen(true)}>
              Filter & sort
            </MChip>
            <MChip>Group: Project</MChip>
          </div>
          <p className="m-caption">
            {itemCount} items{overdueCount ? ` · ${overdueCount} overdue` : ""}
          </p>
          <div className="m-card" style={{ padding: 0, overflow: "hidden" }}>
            {listRenderer()}
          </div>
        </>
      ) : null}

      {seg === "today" ? (
        dailyOn && dailyPlanSlot ? (
          dailyPlanSlot
        ) : (
          <div className="m-card">
            <MListRow
              subtitle="Empty state — only shown when nothing is planned"
              title="Nothing planned for today yet."
              twoLine
            />
            <div style={{ padding: "0 14px 14px" }}>
              <MButton
                loading={busy}
                onClick={() => {
                  if (!user?.uid) return;
                  setBusy(true);
                  void enableDailyPlan(user.uid).finally(() => setBusy(false));
                }}
                size="sm"
              >
                Try Daily Plan
              </MButton>
            </div>
          </div>
        )
      ) : null}

      {seg === "events" ? (
        dailyOn && dailyPlanSlot ? (
          <div data-phone-events>{dailyPlanSlot}</div>
        ) : (
          <MEmpty title="Connect your calendar in Daily Plan to see events." />
        )
      ) : null}

      <MSheet onClose={() => setMoreOpen(false)} open={moreOpen} title="More">
        <MListRow onClick={() => setMoreOpen(false)} title="Saved views" />
        <MListRow onClick={() => setMoreOpen(false)} title="Show completed" />
        <MListRow onClick={() => setMoreOpen(false)} title="Compact rows" />
      </MSheet>
      <MSheet
        footer={
          <MButton full onClick={() => setFilterOpen(false)}>
            Show {itemCount} items
          </MButton>
        }
        onClose={() => setFilterOpen(false)}
        open={filterOpen}
        title="Filter & sort"
      >
        <div className="m-chip-row">
          <MChip onClick={() => navigate("/my-work?filter=today")}>Today</MChip>
          <MChip onClick={() => navigate("/my-work?filter=week")}>This week</MChip>
          <MChip onClick={() => navigate("/my-work?filter=overdue")}>Overdue</MChip>
        </div>
        <p className="m-caption">More filters open the desktop fields via saved views.</p>
      </MSheet>
    </div>
  );
}
