import { useMemo, useState } from "react";
import type { CalendarEvent } from "../../lib/calendar";
import { getLocale, t } from "../../lib/i18n";
import "./calendarOverlay.css";

export type CalendarEventPopoverProps = {
  event: CalendarEvent;
  accountColor?: string;
  onClose: () => void;
  onJoin?: () => void;
  onNotes?: () => void;
  onPrepare?: () => void;
  onOpenExternal?: () => void;
};

export function CalendarEventPopover({
  event,
  accountColor = "var(--accent)",
  onClose,
  onJoin,
  onNotes,
  onPrepare,
  onOpenExternal,
}: CalendarEventPopoverProps) {
  const locale = getLocale() === "es" ? "es" : "en";
  return (
    <div className="cw-cal-popover" data-testid="calendar-event-popover">
      <header>
        <span className="cw-cal-popover-dot" style={{ background: accountColor }} />
        <strong>{event.title}</strong>
        <button onClick={onClose} type="button">
          ×
        </button>
      </header>
      <p className="cw-cal-popover-meta">
        {new Date(event.start).toLocaleString(locale === "es" ? "es" : "en", {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {" – "}
        {new Date(event.end).toLocaleTimeString(locale === "es" ? "es" : "en", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <div className="cw-cal-popover-actions">
        {event.meetingUrl ? (
          <button onClick={onJoin} type="button">
            {t("calendar.join")}
          </button>
        ) : null}
        <button onClick={onNotes} type="button">
          {t("calendar.notes")}
        </button>
        <button onClick={onPrepare} type="button">
          {t("calendar.prepare")}
        </button>
        <button onClick={onOpenExternal} type="button">
          {t("calendar.openGoogle")}
        </button>
      </div>
    </div>
  );
}

export function CalendarEventChip({
  event,
  accountColor = "var(--accent)",
  onSelect,
}: {
  event: CalendarEvent;
  accountColor?: string;
  onSelect: (event: CalendarEvent) => void;
}) {
  const busy = event.privacy === "busy";
  const start = new Date(event.start);
  const platform = event.meetingUrl
    ? /teams\.microsoft|teams\.live/i.test(event.meetingUrl)
      ? "Teams"
      : "Meet"
    : "";
  return (
    <button
      className={`cw-cal-ev ${busy ? "cw-cal-busy" : ""}`}
      onClick={() => onSelect(event)}
      style={{ borderLeftColor: accountColor }}
      type="button"
    >
      <strong>{busy ? t("calendar.busy") : event.title}</strong>
      <span>
        {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {platform ? ` · ${platform}` : ""}
      </span>
    </button>
  );
}

export function eventsForDay(events: CalendarEvent[], day: Date) {
  const key = day.toISOString().slice(0, 10);
  return events.filter((event) => String(event.start).slice(0, 10) === key);
}

export function useEventSelection() {
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  return useMemo(() => ({ selected, setSelected }), [selected]);
}
