import { useMemo, useState } from "react";
import { Settings, RefreshCw } from "../../../components/ui/Icon";
import { BUCKETS } from "../buckets";
import { updatePlanFields } from "../dayPlanService";
import type { DayPlan, EventTag, PlanBucket, PlanItem } from "../types";
import type { CalEvent } from "../calendar/types";
import { CalendarSettingsSheet } from "./CalendarSettingsSheet";
import type { CalendarConnections } from "../calendar/types";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const HOUR_PX = 44;

function topFor(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const mins = d.getHours() * 60 + d.getMinutes() - 8 * 60;
  return Math.max(0, (mins / 60) * HOUR_PX);
}

function heightFor(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 20;
  return Math.max(20, ((b - a) / 3600000) * HOUR_PX);
}

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
  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);
  const now = new Date();
  const showNow = dateKey === now.toISOString().slice(0, 10);
  const nowTop = ((now.getHours() * 60 + now.getMinutes() - 8 * 60) / 60) * HOUR_PX;

  // Time blocks from plan entries (unsynced = dashed)
  const blocks = (plan?.entries || [])
    .filter((e) => e.timeBlock?.start && e.timeBlock?.end)
    .map((e) => {
      const item = items.find((i) => i.id === e.itemId);
      const start = e.timeBlock!.start.toDate?.() || new Date();
      const end = e.timeBlock!.end.toDate?.() || new Date();
      return {
        eventKey: `block:${e.itemId}`,
        title: String(item?.title || "Time block"),
        start: start.toISOString(),
        end: end.toISOString(),
        bucket: e.bucket,
        synced: Boolean(e.timeBlock!.calendarEventId),
      };
    });

  return (
    <div className="dp-events-col dp-panel" data-testid="daily-plan-events">
      <div className="dp-evh">
        <h3>Events</h3>
        <span className="dp-board-meta">{dateKey.slice(5)}</span>
        <span style={{ marginLeft: "auto" }} />
        <button aria-label="Refresh" className="dp-icobtn" onClick={onRefresh} type="button">
          <RefreshCw size={15} />
        </button>
        <button
          aria-label="Calendar settings"
          className="dp-icobtn"
          onClick={() => setSettingsOpen(true)}
          type="button"
        >
          <Settings size={15} />
        </button>
      </div>
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
      ) : (
        <>
          {allDay.length ? (
            <ul className="dp-events-list">
              {allDay.map((ev) => (
                <li key={ev.eventKey}>
                  <button className="dp-ev" onClick={() => setActive(ev)} type="button">
                    <b>{ev.title}</b>
                    <small>All day</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="dp-tl">
            {HOURS.map((h, i) => (
              <div className="dp-hr" key={h} style={{ top: i * HOUR_PX }}>
                <span>{h}:00</span>
              </div>
            ))}
            {showNow && nowTop >= 0 && nowTop <= HOURS.length * HOUR_PX ? (
              <div className="dp-now" style={{ top: nowTop }} />
            ) : null}
            {timed.map((ev) => {
              const tag = tags.get(ev.eventKey);
              const bucketClass = tag?.bucket || "";
              return (
                <button
                  className={`dp-ev ${bucketClass}`}
                  key={ev.eventKey}
                  onClick={() => setActive(ev)}
                  style={{
                    top: topFor(ev.start),
                    height: heightFor(ev.start, ev.end),
                  }}
                  type="button"
                >
                  <b>{ev.title}</b>
                  <small>
                    {ev.start.slice(11, 16)}–{ev.end.slice(11, 16)}
                    {tag?.itemId
                      ? ` · ${String(items.find((i) => i.id === tag.itemId)?.title || "")}`
                      : ""}
                  </small>
                </button>
              );
            })}
            {blocks.map((b) => (
              <div
                className={`dp-ev block ${b.bucket}${b.synced ? "" : ""}`}
                key={b.eventKey}
                style={{ top: topFor(b.start), height: heightFor(b.start, b.end) }}
              >
                <b>{b.title}</b>
                <small>
                  {b.start.slice(11, 16)}–{b.end.slice(11, 16)}
                  {b.synced ? "" : " · time block, not synced"}
                </small>
              </div>
            ))}
          </div>
          <div className="dp-evfoot">
            {connections?.accounts?.[0]?.email
              ? `Google · ${connections.accounts[0].email} · ${connections.accounts.reduce((n, a) => n + a.calendars.filter((c) => c.selected).length, 0)} calendars. Drag a card here to block time.`
              : "Drag a card here to block time."}
          </div>
        </>
      )}
      {active ? (
        <div className="dp-sheet" style={{ position: "absolute", width: "100%" }}>
          <header className="dp-sh">
            <h3>{active.title}</h3>
            <button className="dp-icobtn" onClick={() => setActive(null)} style={{ marginLeft: "auto" }} type="button">
              ✕
            </button>
          </header>
          <div className="dp-sb">
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
            <div className="dp-leftovers-buckets" style={{ marginTop: 12 }}>
              {(["fire", "growth", "extra"] as PlanBucket[]).map((b) => (
                <button
                  key={b}
                  onClick={() => void setTag(active.eventKey, b)}
                  style={{ width: "auto", padding: "4px 10px" }}
                  type="button"
                >
                  Tag {BUCKETS[b].label}
                </button>
              ))}
              <button onClick={() => void removeTag(active.eventKey)} type="button">
                Remove tag
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
