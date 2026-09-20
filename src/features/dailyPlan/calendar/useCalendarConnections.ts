import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import type { CalendarConnections } from "./types";

export function useCalendarConnections(uid: string | undefined) {
  const [connections, setConnections] = useState<CalendarConnections | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setConnections(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, "calendarConnections", uid),
      (snap) => {
        setConnections(snap.exists() ? (snap.data() as CalendarConnections) : null);
        setLoading(false);
      },
      () => {
        setConnections(null);
        setLoading(false);
      },
    );
  }, [uid]);

  const setCalendarSelected = async (
    accountId: string,
    calendarId: string,
    selected: boolean,
  ) => {
    if (!uid || !connections) return;
    const accounts = connections.accounts.map((account) =>
      account.accountId !== accountId
        ? account
        : {
            ...account,
            calendars: account.calendars.map((cal) =>
              cal.calendarId === calendarId ? { ...cal, selected } : cal,
            ),
          },
    );
    await updateDoc(doc(db, "calendarConnections", uid), {
      accounts,
      updatedAt: serverTimestamp(),
    });
  };

  return { connections, loading, setCalendarSelected };
}
