import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "../../../components/ui/Icon";
import { BUCKETS, BUCKET_ORDER } from "../buckets";
import { leftoversHeader } from "../dateKeys";
import type { LeftoverEntry } from "../useDayPlan";
import type { PlanBucket, PlanItem } from "../types";
import { BucketPickMenu } from "./DailyPlanCTA";

function RowAddToday({
  itemId,
  onAdd,
}: {
  itemId: string;
  onAdd: (itemId: string, bucket: PlanBucket) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dp-row-add">
      <button
        className="dp-row-add-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        type="button"
      >
        + Today
      </button>
      {open ? (
        <BucketPickMenu
          onClose={() => setOpen(false)}
          onPick={(bucket) => onAdd(itemId, bucket)}
        />
      ) : null}
    </div>
  );
}

export function PlanningTray({
  leftovers,
  todayKey,
  plannedIds,
  children,
  onAdd,
  onMoveAll,
}: {
  leftovers: LeftoverEntry[];
  todayKey: string;
  plannedIds: Set<string>;
  children: React.ReactNode;
  onAdd: (itemId: string, bucket: PlanBucket) => void;
  onMoveAll: (bucket: PlanBucket) => void;
}) {
  const [open, setOpen] = useState(true);
  const [moveAllOpen, setMoveAllOpen] = useState(false);
  const fromKey = leftovers[0]?.fromDateKey || "";
  const header = fromKey ? leftoversHeader(fromKey, todayKey) : "From yesterday";

  const visibleLeftovers = useMemo(
    () => leftovers.filter((e) => !plannedIds.has(e.itemId)),
    [leftovers, plannedIds],
  );

  return (
    <div className="dp-planning-tray" data-testid="daily-plan-tray">
      {visibleLeftovers.length > 0 ? (
        <section className="dp-leftovers" data-testid="daily-plan-leftovers">
          <header className="dp-leftovers-head">
            <button onClick={() => setOpen((v) => !v)} type="button">
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{header}</span>
              <span className="dp-leftovers-count">{visibleLeftovers.length}</span>
            </button>
            <div className="dp-leftovers-move-all">
              <button onClick={() => setMoveAllOpen((v) => !v)} type="button">
                Move all to…
              </button>
              {moveAllOpen ? (
                <BucketPickMenu
                  onClose={() => setMoveAllOpen(false)}
                  onPick={(bucket) => {
                    onMoveAll(bucket);
                    setMoveAllOpen(false);
                  }}
                />
              ) : null}
            </div>
          </header>
          {open ? (
            <ul className="dp-leftovers-list">
              {visibleLeftovers.map((entry) => (
                <li key={entry.itemId}>
                  <span className="dp-leftovers-title">
                    {String(entry.item.title || "Untitled")}
                  </span>
                  <div className="dp-leftovers-buckets">
                    {BUCKET_ORDER.map((b) => (
                      <button
                        key={b}
                        onClick={() => onAdd(entry.itemId, b)}
                        style={{ color: BUCKETS[b].fg }}
                        type="button"
                      >
                        {BUCKETS[b].label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {children}
    </div>
  );
}

export function RowTodayAffordance({
  item,
  plannedBucket,
  onAdd,
  onMove,
}: {
  item: PlanItem;
  plannedBucket?: PlanBucket | null;
  onAdd: (itemId: string, bucket: PlanBucket) => void;
  onMove: (itemId: string, bucket: PlanBucket) => void;
}) {
  const [open, setOpen] = useState(false);
  if (plannedBucket) {
    return (
      <div className="dp-row-add is-planned">
        <button
          aria-label={`In ${BUCKETS[plannedBucket].label}`}
          className="dp-row-dot"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          style={{ background: BUCKETS[plannedBucket].fg }}
          type="button"
        />
        {open ? (
          <BucketPickMenu
            onClose={() => setOpen(false)}
            onPick={(bucket) => onMove(item.id, bucket)}
          />
        ) : null}
      </div>
    );
  }
  return <RowAddToday itemId={item.id} onAdd={onAdd} />;
}
