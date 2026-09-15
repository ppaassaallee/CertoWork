import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/AuthContext";
import { t } from "../../lib/i18n";
import type { Calendar, CalendarAccount, CalendarEvent } from "../../lib/calendar";

function applyPrivacy(event: CalendarEvent, calendars: Calendar[]): CalendarEvent {
  const calendar = calendars.find((row) => row.id === event.calendarId);
  const privacy = event.privacy || calendar?.privacy || "full";
  if (privacy !== "busy") return { ...event, privacy };
  return {
    ...event,
    privacy: "busy",
    title: t("calendar.busy"),
    attendees: [],
    location: null,
    meetingUrl: null,
  };
}

export function useCalendarEvents(range?: { from?: string; to?: string }) {
  const { user, workspace } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubs = [
      onSnapshot(
        query(collection(db, "calendar_accounts"), where("userId", "==", user.uid)),
        (snap) =>
          setAccounts(
            snap.docs.map((row) => ({ id: row.id, ...(row.data() as object) }) as CalendarAccount),
          ),
      ),
      onSnapshot(
        query(collection(db, "calendars"), where("userId", "==", user.uid)),
        (snap) =>
          setCalendars(
            snap.docs.map((row) => ({ id: row.id, ...(row.data() as object) }) as Calendar),
          ),
      ),
      onSnapshot(
        query(collection(db, "calendar_events"), where("userId", "==", user.uid)),
        (snap) =>
          setEvents(
            snap.docs.map((row) => ({ id: row.id, ...(row.data() as object) }) as CalendarEvent),
          ),
      ),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user?.uid, workspace?.id]);

  const visible = useMemo(() => {
    const fromMs = range?.from ? Date.parse(range.from) : null;
    const toMs = range?.to ? Date.parse(range.to) : null;
    return events
      .filter((event) => {
        const calendar = calendars.find((row) => row.id === event.calendarId);
        if (calendar && calendar.visible === false) return false;
        const start = Date.parse(event.start);
        if (!Number.isFinite(start)) return false;
        if (fromMs != null && start < fromMs) return false;
        if (toMs != null && start > toMs) return false;
        return true;
      })
      .map((event) => applyPrivacy(event, calendars));
  }, [events, calendars, range?.from, range?.to]);

  return { events: visible, accounts, calendars };
}
