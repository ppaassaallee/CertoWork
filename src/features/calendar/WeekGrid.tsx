import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/AuthContext";
import { findFreeSlots } from "../../lib/calendar/freeSlots";
import {
  eventDayKeys,
  localDayKey,
  minutesFromMidnight,
} from "../../lib/calendar/dates";
import type { CalendarEvent } from "../../lib/calendar";
import { createNote, ensurePersonalNotebook, linkNote } from "../../lib/notes";
import { getLocale, t } from "../../lib/i18n";
import { useCalendarEvents } from "./useCalendarEvents";
import { CalendarEventChip, CalendarEventPopover } from "./CalendarEventChip";
import { CalendarMonthView } from "./CalendarMonthView";
import "./calendarOverlay.css";

const HOUR_PX = 48;
const START_HOUR = 7;
const END_HOUR = 19;
const GRID_START = 0;
const GRID_END = 24;

function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

type Props = {
  onPrepareEvent?: (event: CalendarEvent) => void;
  tasks?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
};

export function WeekGrid({ onPrepareEvent, tasks = [], projects = [] }: Props) {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const locale = getLocale() === "es" ? "es" : "en";
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [workdaysOnly, setWorkdaysOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<CalendarEvent | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [freeHint, setFreeHint] = useState<string | null>(null);
  const [calMode, setCalMode] = useState<"week" | "month">("week");
  const { events, accounts, accountColor } = useCalendarEvents();

  const days = useMemo(() => {
    const count = workdaysOnly ? 5 : 7;
    return Array.from({ length: count }, (_, i) => addDays(anchor, i));
  }, [anchor, workdaysOnly]);

  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    [],
  );

  const weekLabel = `${anchor.toLocaleDateString(locale === "es" ? "es" : "en", {
    month: "short",
    day: "numeric",
  })} – ${addDays(anchor, days.length - 1).toLocaleDateString(locale === "es" ? "es" : "en", {
    month: "short",
    day: "numeric",
  })}`;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const openNotes = async (event: CalendarEvent) => {
    if (!user || !workspace) return;
    if (event.linkedNoteId) {
      navigate(`/notes?note=${encodeURIComponent(event.linkedNoteId)}`);
      return;
    }
    const personal = await ensurePersonalNotebook(user.uid, workspace.id);
    const noteId = await createNote({
      userId: user.uid,
      workspaceId: workspace.id,
      notebookId: personal.notebookId,
      sectionId: personal.inboxId,
      title: event.title,
      noteType: "meeting",
      meetingDate: eventDayKeys(event)[0] || localDayKey(new Date()),
      attendeeIds: (event.attendees || []).map((a) => a.email || a.displayName || "").filter(Boolean),
      projectId: event.linkedProjectId || null,
      visibility: "private",
      contentMarkdown: "",
    });
    await updateDoc(doc(db, "calendar_events", event.id), { linkedNoteId: noteId });
    if (event.linkedItemId) {
      await linkNote({
        workspaceId: workspace.id,
        userId: user.uid,
        noteId,
        target: { type: "task", id: event.linkedItemId },
      }).catch(() => {});
    }
    navigate(`/notes?note=${encodeURIComponent(noteId)}`);
  };

  const linkCandidates = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    if (!q) return [] as Array<{ id: string; title: string; kind: "task" | "project" }>;
    const fromTasks = tasks
      .filter((row) => String(row.title || row.name || "").toLowerCase().includes(q))
      .slice(0, 8)
      .map((row) => ({
        id: String(row.id),
        title: String(row.title || row.name || ""),
        kind: "task" as const,
      }));
    const fromProjects = projects
      .filter((row) => String(row.title || row.name || "").toLowerCase().includes(q))
      .slice(0, 8)
      .map((row) => ({
        id: String(row.id),
        title: String(row.title || row.name || ""),
        kind: "project" as const,
      }));
    return [...fromProjects, ...fromTasks].slice(0, 12);
  }, [linkQuery, projects, tasks]);

  return (
    <section className="cw-cal-week" data-testid="my-work-week-grid">
      <header className="cw-cal-week-head">
        <div>
          <strong>
            {locale === "es" ? "Mi trabajo · Eventos" : "My Work · Events"}
          </strong>
          <span>{calMode === "month" ? "Month" : weekLabel}</span>
        </div>
        <div className="cw-cal-week-nav">
          <button
            className={calMode === "week" ? "is-active" : ""}
            onClick={() => setCalMode("week")}
            type="button"
          >
            Week
          </button>
          <button
            className={calMode === "month" ? "is-active" : ""}
            onClick={() => setCalMode("month")}
            type="button"
          >
            Month
          </button>
          {calMode === "week" ? (
            <>
          <button onClick={() => setAnchor((a) => addDays(a, -7))} type="button">
            ‹
          </button>
          <button onClick={() => setAnchor(mondayOf(new Date()))} type="button">
            {locale === "es" ? "Hoy" : "Today"}
          </button>
          <button onClick={() => setAnchor((a) => addDays(a, 7))} type="button">
            ›
          </button>
          <button
            className={workdaysOnly ? "is-active" : ""}
            onClick={() => setWorkdaysOnly((v) => !v)}
            type="button"
          >
            {workdaysOnly ? "Lun–Vie" : "Lun–Dom"}
          </button>
            </>
          ) : null}
        </div>
        <ul className="cw-cal-week-legend">
          {accounts
            .filter((a) => a.status !== "disconnected")
            .map((account) => (
              <li key={account.id}>
                <i style={{ background: accountColor(account.id) }} />
                {account.email || account.displayName}
              </li>
            ))}
        </ul>
      </header>

      {calMode === "month" ? (
        <div style={{ padding: 12 }}>
          <CalendarMonthView
            events={events.map((e) => ({
              id: e.id,
              title: e.title,
              start: e.start,
              end: e.end,
              bucket: e.certo?.blockOf === "plan" ? "fire" : "growth",
              allDay: e.allDay,
            }))}
            initialMode="month"
            onAdd={() => undefined}
          />
        </div>
      ) : (
      <>
      <div className="cw-cal-week-allday">
        <div className="cw-cal-week-gutter" />
        {days.map((day) => {
          const key = localDayKey(day);
          const allDay = events.filter((e) => e.allDay && eventDayKeys(e).includes(key));
          return (
            <div className="cw-cal-week-allday-col" key={`ad-${key}`}>
              {allDay.map((event) => (
                <CalendarEventChip
                  accountColor={accountColor(event.accountId)}
                  event={event}
                  key={event.id}
                  onSelect={(row) => setSelectedId(row.id)}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="cw-cal-week-scroll">
        <div
          className="cw-cal-week-grid"
          style={{
            gridTemplateColumns: `36px repeat(${days.length}, minmax(0, 1fr))`,
            height: (END_HOUR - START_HOUR) * HOUR_PX,
          }}
        >
          <div className="cw-cal-week-hours">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((day) => {
            const key = localDayKey(day);
            const isToday = key === localDayKey(now);
            const dayEvents = events.filter((e) => !e.allDay && eventDayKeys(e).includes(key));
            const free =
              day.getDay() !== 0 &&
              day.getDay() !== 6 &&
              day >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
                ? findFreeSlots(
                    dayEvents.map((e) => ({ start: e.start, end: e.end })),
                    {
                      from: `${key}T00:00:00`,
                      to: `${key}T23:59:59`,
                      minMinutes: 90,
                      workHours: { start: 8, end: 18 },
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                    },
                  )
                : [];
            return (
              <div className={`cw-cal-week-col ${isToday ? "is-today" : ""}`} key={key}>
                <header>
                  {day.toLocaleDateString(locale === "es" ? "es" : "en", {
                    weekday: "short",
                    day: "numeric",
                  })}
                </header>
                <div className="cw-cal-week-lanes" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
                  {hours.map((h) => (
                    <div className="cw-cal-week-hourline" key={`${key}-${h}`} style={{ top: (h - START_HOUR) * HOUR_PX }} />
                  ))}
                  {isToday && nowMins >= START_HOUR * 60 && nowMins <= END_HOUR * 60 ? (
                    <div
                      className="cw-cal-week-now"
                      style={{ top: ((nowMins - START_HOUR * 60) / 60) * HOUR_PX }}
                    />
                  ) : null}
                  {dayEvents.map((event, index) => {
                    const startM = minutesFromMidnight(event.start);
                    const endM = Math.max(startM + 30, minutesFromMidnight(event.end));
                    const top = ((Math.max(startM, START_HOUR * 60) - START_HOUR * 60) / 60) * HOUR_PX;
                    const height = Math.max(24, ((endM - startM) / 60) * HOUR_PX);
                    const overlap = index % 3;
                    return (
                      <div
                        className="cw-cal-week-event"
                        key={event.id}
                        style={{
                          top,
                          height,
                          left: `${overlap * 33}%`,
                          width: "33%",
                        }}
                      >
                        <CalendarEventChip
                          accountColor={accountColor(event.accountId)}
                          event={event}
                          onSelect={(row) => setSelectedId(row.id)}
                        />
                        {selectedId === event.id ? (
                          <CalendarEventPopover
                            accountColor={accountColor(event.accountId)}
                            event={event}
                            onClose={() => setSelectedId(null)}
                            onJoin={() => event.meetingUrl && window.open(event.meetingUrl, "_blank")}
                            onLink={() => {
                              setLinkFor(event);
                              setLinkQuery("");
                            }}
                            onNotes={() => void openNotes(event)}
                            onOpenExternal={() =>
                              window.open(
                                `https://calendar.google.com/calendar/u/0/r/eventedit/${encodeURIComponent(event.externalId)}`,
                                "_blank",
                              )
                            }
                            onPrepare={() => {
                              onPrepareEvent?.(event);
                              setSelectedId(null);
                            }}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                  {free.map((slot) => {
                    const startM = minutesFromMidnight(slot.start);
                    const endM = minutesFromMidnight(slot.end);
                    if (endM <= START_HOUR * 60 || startM >= END_HOUR * 60) return null;
                    const top = ((Math.max(startM, START_HOUR * 60) - START_HOUR * 60) / 60) * HOUR_PX;
                    const height = ((Math.min(endM, END_HOUR * 60) - Math.max(startM, START_HOUR * 60)) / 60) * HOUR_PX;
                    const mins = endM - startM;
                    return (
                      <button
                        className="cw-cal-week-free"
                        key={`${slot.start}-${slot.end}`}
                        onClick={() => setFreeHint(t("calendar.freeSlotHint"))}
                        style={{ top, height }}
                        type="button"
                      >
                        {locale === "es" ? `Libre ${Math.round(mins / 60)} h` : `Free ${Math.round(mins / 60)} h`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {freeHint ? (
        <p className="cw-cal-week-hint" role="status">
          {freeHint}
          <button onClick={() => setFreeHint(null)} type="button">
            ×
          </button>
        </p>
      ) : null}

      </>
      )}

      {linkFor ? (
        <div className="cw-cal-link-popover">
          <strong>{t("calendar.link")}</strong>
          <input
            onChange={(e) => setLinkQuery(e.target.value)}
            placeholder={locale === "es" ? "Buscar proyecto o ítem…" : "Search project or item…"}
            value={linkQuery}
          />
          <ul>
            {linkCandidates.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                <button
                  onClick={() => {
                    void updateDoc(doc(db, "calendar_events", linkFor.id), {
                      linkedItemId: row.kind === "task" ? row.id : null,
                      linkedProjectId: row.kind === "project" ? row.id : linkFor.linkedProjectId || null,
                    });
                    setLinkFor(null);
                  }}
                  type="button"
                >
                  {row.kind === "project" ? "📁" : "✓"} {row.title}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setLinkFor(null)} type="button">
            {locale === "es" ? "Cerrar" : "Close"}
          </button>
        </div>
      ) : null}

      {/* silence unused GRID constants for future full-day scroll */}
      <span hidden>{GRID_START + GRID_END}</span>
    </section>
  );
}
