import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "./ui/Icon";
import { useCalendarEvents } from "../features/calendar/useCalendarEvents";
import { CalendarEventChip } from "../features/calendar/CalendarEventChip";
import {
  eventsForLocalDay,
  localDayKey,
} from "../lib/calendar/dates";
import type { CalendarEvent } from "../lib/calendar";
import { t } from "../lib/i18n";

function startOfWeek(day: Date): Date {
  const d = new Date(day);
  const weekday = d.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(day: Date, count: number): Date {
  const d = new Date(day);
  d.setDate(d.getDate() + count);
  return d;
}

function formatDuration(ms: number, locale: "es" | "en"): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours && rem) return locale === "es" ? `${hours}h ${rem}m` : `${hours}h ${rem}m`;
  if (hours) return `${hours}h`;
  return `${rem}m`;
}

function eventDurationMs(event: CalendarEvent): number {
  if (event.allDay) return 0;
  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return end - start;
}

export function MyWorkDaySchedule({
  locale = "es",
  selectedDay,
  onSelectDay,
  onOpenWeek,
  onPrepareEvent,
}: {
  locale?: "es" | "en";
  selectedDay: Date;
  onSelectDay(day: Date): void;
  onOpenWeek(): void;
  onPrepareEvent?(event: CalendarEvent): void;
}) {
  const weekStart = startOfWeek(selectedDay);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart.getTime()],
  );
  const range = useMemo(() => {
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    return { from, to };
  }, [weekStart.getTime()]);
  const { events, accountColor } = useCalendarEvents(range);
  const dayEvents = useMemo(
    () =>
      eventsForLocalDay(events, selectedDay).sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return String(a.start).localeCompare(String(b.start));
      }),
    [events, localDayKey(selectedDay)],
  );
  const timedMs = dayEvents.reduce((sum, event) => sum + eventDurationMs(event), 0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = dayEvents.find((event) => event.id === activeId) || null;
  const selectedKey = localDayKey(selectedDay);
  const todayKey = localDayKey(new Date());

  const dayLabel = selectedDay.toLocaleDateString(locale === "es" ? "es" : "en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <aside className="do-today-schedule" data-testid="my-work-day-schedule">
      <header className="do-today-schedule-head">
        <div>
          <strong>{locale === "es" ? "Agenda" : "Schedule"}</strong>
          <span>{dayLabel}</span>
        </div>
        <button
          className="do-today-schedule-week"
          data-testid="my-work-open-week"
          onClick={onOpenWeek}
          type="button"
        >
          <Calendar size={13} />
          {locale === "es" ? "Ver semana" : "Open week"}
        </button>
      </header>

      <div className="do-today-date-strip" data-testid="my-work-date-strip">
        <button
          aria-label={locale === "es" ? "Semana anterior" : "Previous week"}
          className="do-today-date-nav"
          onClick={() => onSelectDay(addDays(selectedDay, -7))}
          type="button"
        >
          <ChevronLeft size={14} />
        </button>
        {weekDays.map((day) => {
          const key = localDayKey(day);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          return (
            <button
              className={`do-today-date-chip${isSelected ? " is-selected" : ""}${
                isToday ? " is-today" : ""
              }`}
              key={key}
              onClick={() => onSelectDay(day)}
              type="button"
            >
              <em>
                {day.toLocaleDateString(locale === "es" ? "es" : "en", {
                  weekday: "short",
                })}
              </em>
              <strong>{day.getDate()}</strong>
            </button>
          );
        })}
        <button
          aria-label={locale === "es" ? "Semana siguiente" : "Next week"}
          className="do-today-date-nav"
          onClick={() => onSelectDay(addDays(selectedDay, 7))}
          type="button"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="do-today-schedule-meta">
        {timedMs > 0
          ? formatDuration(timedMs, locale)
          : locale === "es"
            ? "Sin bloques con hora"
            : "No timed blocks"}
        {" · "}
        {dayEvents.length}{" "}
        {locale === "es"
          ? dayEvents.length === 1
            ? "evento"
            : "eventos"
          : dayEvents.length === 1
            ? "event"
            : "events"}
      </div>

      {dayEvents.length === 0 ? (
        <div className="do-today-schedule-empty">
          <Calendar size={18} />
          <strong>
            {locale === "es" ? "Día libre en el calendario" : "Clear on the calendar"}
          </strong>
          <span>
            {locale === "es"
              ? "Conectá Google en Integraciones o abrí la semana para planificar bloques."
              : "Connect Google in Integrations, or open the week to plan blocks."}
          </span>
          <button onClick={onOpenWeek} type="button">
            {locale === "es" ? "Ir a Semana" : "Go to Week"}
          </button>
        </div>
      ) : (
        <ul className="do-today-schedule-list">
          {dayEvents.map((event) => (
            <li key={event.id}>
              <CalendarEventChip
                accountColor={accountColor(event.accountId)}
                event={event}
                onSelect={(next) => setActiveId(next.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {active ? (
        <div className="do-today-schedule-popover">
          <strong>{active.title}</strong>
          <p>
            {active.allDay
              ? t("calendar.allDay")
              : `${new Date(active.start).toLocaleTimeString(locale === "es" ? "es" : "en", {
                  hour: "2-digit",
                  minute: "2-digit",
                })} – ${new Date(active.end).toLocaleTimeString(locale === "es" ? "es" : "en", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
          </p>
          <div className="do-today-schedule-actions">
            {active.meetingUrl ? (
              <a href={active.meetingUrl} rel="noreferrer" target="_blank">
                {t("calendar.join")}
              </a>
            ) : null}
            {onPrepareEvent ? (
              <button
                onClick={() => {
                  onPrepareEvent(active);
                  setActiveId(null);
                }}
                type="button"
              >
                {t("calendar.prepare")}
              </button>
            ) : null}
            <button onClick={() => setActiveId(null)} type="button">
              {locale === "es" ? "Cerrar" : "Close"}
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
