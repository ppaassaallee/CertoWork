import { useMemo, useState } from "react";
import { Settings, RefreshCw } from "../../../components/ui/Icon";
import { BUCKETS } from "../buckets";
import { updatePlanFields } from "../dayPlanService";
import type { DayPlan, EventTag, PlanBucket, PlanItem } from "../types";
import type { CalEvent } from "../calendar/types";
import { CalendarSettingsSheet } from "./CalendarSettingsSheet";
import type { CalendarConnections } from "../calendar/types";

export function EventsColumn({
  dateKey,
  uid,
  plan,
  events,
  loading,
  notConfigured,
  connections,
  items,
  onRefresh,
  onNotice,
  setCalendarSelected,
}: {
  dateKey: string;
  uid: string;
  plan: DayPlan | null;
  events: CalEvent[];
  loading: boolean;
  notConfigured: boolean;
  connections: CalendarConnections | null;
  items: PlanItem[];
  onRefresh: () => void;
  onNotice?: (msg: string) => void;
  setCalendarSelected: (
    accountId: string,
    calendarId: string,
    selected: boolean,
  ) => Promise<void>;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [active, setActive] = useState<CalEvent | null>(null);
  const tags = useMemo(() => {
    const map = new Map<string, EventTag>();
    for (const tag of plan?.eventTags || []) map.set(tag.eventKey, tag);
    return map;
  }, [plan?.eventTags]);

  const setTag = async (eventKey: string, bucket: PlanBucket, itemId?: string | null) => {
    const next = [...(plan?.eventTags || []).filter((t) => t.eventKey !== eventKey)];
    next.push({ eventKey, bucket, itemId: itemId ?? null });
    await updatePlanFields(uid, dateKey, { eventTags: next });
  };

  const removeTag = async (eventKey: string) => {
    const next = (plan?.eventTags || []).filter((t) => t.eventKey !== eventKey);
    await updatePlanFields(uid, dateKey, { eventTags: next });
  };

  const hasAccount = Boolean(connections?.accounts?.length);

  return (
    <div className="dp-events-col" data-testid="daily-plan-events">
      <header className="dp-board-header">
        <h3>Events</h3>
        <button aria-label="Refresh" onClick={onRefresh} type="button">
          <RefreshCw size={14} />
        </button>
        <button aria-label="Calendar settings" onClick={() => setSettingsOpen(true)} type="button">
          <Settings size={14} />
        </button>
      </header>
      {settingsOpen ? (
        <CalendarSettingsSheet
          connections={connections}
          onClose={() => setSettingsOpen(false)}
          onNotice={onNotice}
          setCalendarSelected={setCalendarSelected}
          uid={uid}
        />
      ) : null}
      {!hasAccount || notConfigured ? (
        <div className="dp-events-empty">
          <p>{notConfigured ? "Calendar not configured." : "Connect your calendar"}</p>
          <button className="dp-cta-btn" onClick={() => setSettingsOpen(true)} type="button">
            Connect your calendar
          </button>
        </div>
      ) : loading ? (
        <p className="dp-events-empty">Loading events…</p>
      ) : !events.length ? (
        <p className="dp-events-empty">No events today</p>
      ) : (
        <ul className="dp-events-list">
          {events.map((ev) => {
            const tag = tags.get(ev.eventKey);
            const style = tag
              ? {
                  background: BUCKETS[tag.bucket].bg,
                  borderColor: BUCKETS[tag.bucket].border,
                  color: BUCKETS[tag.bucket].fg,
                }
              : undefined;
            const linked = tag?.itemId
              ? items.find((i) => i.id === tag.itemId)
              : null;
            return (
              <li key={ev.eventKey}>
                <button
                  className="dp-event-block"
                  onClick={() => setActive(ev)}
                  style={style}
                  type="button"
                >
                  <strong>{ev.title}</strong>
                  <span>
                    {ev.allDay
                      ? "All day"
                      : `${ev.start.slice(11, 16)}–${ev.end.slice(11, 16)}`}
                  </span>
                  {linked ? <small>{String(linked.title)}</small> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {active ? (
        <div className="dp-sheet">
          <header>
            <h3>{active.title}</h3>
            <button onClick={() => setActive(null)} type="button">
              Close
            </button>
          </header>
          <p>
            {active.allDay
              ? "All day"
              : `${active.start.slice(11, 16)}–${active.end.slice(11, 16)}`}
            {active.attendeesCount ? ` · ${active.attendeesCount} attendees` : ""}
          </p>
          {active.meetingLink ? (
            <a href={active.meetingLink} rel="noreferrer" target="_blank">
              Join
            </a>
          ) : null}
          {active.htmlLink ? (
            <a href={active.htmlLink} rel="noreferrer" target="_blank">
              Open in calendar
            </a>
          ) : null}
          <div className="dp-leftovers-buckets">
            {(["fire", "growth", "extra"] as PlanBucket[]).map((b) => (
              <button key={b} onClick={() => void setTag(active.eventKey, b)} type="button">
                Tag {BUCKETS[b].label}
              </button>
            ))}
            <button onClick={() => void removeTag(active.eventKey)} type="button">
              Remove tag
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
