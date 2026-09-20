import { useCallback, useEffect, useRef, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../../lib/firebase";
import { isGoogleCalendarConfigured } from "./googleAuth";
import type { CalEvent } from "./types";
import type { CalendarConnections } from "./types";

export function useDayEvents(
  dateKey: string,
  connections: CalendarConnections | null,
) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Array<{ accountId: string; code: string }>>([]);
  const [notConfigured, setNotConfigured] = useState(!isGoogleCalendarConfigured());
  const cache = useRef<Map<string, CalEvent[]>>(new Map());
  const lastFocus = useRef(0);

  const refresh = useCallback(async () => {
    if (!isGoogleCalendarConfigured()) {
      setNotConfigured(true);
      setEvents([]);
      return;
    }
    if (!connections?.accounts?.length) {
      setEvents([]);
      setErrors([]);
      return;
    }
    setLoading(true);
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "calendarListEvents");
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fn({ dateKey, tz });
      const data = res.data as { events: CalEvent[]; errors: Array<{ accountId: string; code: string }> };
      cache.current.set(dateKey, data.events || []);
      setEvents(data.events || []);
      setErrors(data.errors || []);
      setNotConfigured(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/calendar-not-configured|failed-precondition/i.test(msg)) {
        setNotConfigured(true);
        setEvents([]);
      } else {
        setErrors([{ accountId: "all", code: msg }]);
      }
    } finally {
      setLoading(false);
    }
  }, [dateKey, connections]);

  useEffect(() => {
    const cached = cache.current.get(dateKey);
    if (cached) setEvents(cached);
    void refresh();
  }, [dateKey, connections?.updatedAt, refresh]);

  useEffect(() => {
    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocus.current < 5 * 60 * 1000) return;
      lastFocus.current = now;
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { events, loading, errors, notConfigured, refresh };
}
