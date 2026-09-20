import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../../lib/firebase";
import { isGoogleCalendarConfigured, requestGoogleCalendarCode } from "../calendar/googleAuth";
import type { CalendarAccount, CalendarConnections } from "../calendar/types";

export function CalendarSettingsSheet({
  uid: _uid,
  connections,
  onClose,
  onNotice,
  setCalendarSelected,
}: {
  uid: string;
  connections: CalendarConnections | null;
  onClose: () => void;
  onNotice?: (msg: string) => void;
  setCalendarSelected: (
    accountId: string,
    calendarId: string,
    selected: boolean,
  ) => Promise<void>;
}) {
  void _uid;
  const [busy, setBusy] = useState(false);
  const configured = isGoogleCalendarConfigured();

  const connectGoogle = async () => {
    if (!configured) {
      onNotice?.("Set VITE_GOOGLE_OAUTH_CLIENT_ID and function secrets GOOGLE_OAUTH_CLIENT_ID/SECRET");
      return;
    }
    setBusy(true);
    try {
      const code = await requestGoogleCalendarCode();
      const fn = httpsCallable(getFunctions(app, "us-central1"), "calendarConnect");
      await fn({
        provider: "google",
        code,
        redirectUri: window.location.origin,
      });
      onNotice?.("Google calendar connected");
    } catch (err) {
      onNotice?.(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (accountId: string) => {
    setBusy(true);
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "calendarDisconnect");
      await fn({ accountId });
    } catch (err) {
      onNotice?.(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dp-sheet" data-testid="daily-plan-calendar-settings">
      <header>
        <h3>Calendar</h3>
        <button onClick={onClose} type="button">
          Close
        </button>
      </header>
      {!configured ? (
        <p className="dp-events-empty">
          Calendar not configured. Set <code>VITE_GOOGLE_OAUTH_CLIENT_ID</code> and function
          secrets <code>GOOGLE_OAUTH_CLIENT_ID</code> / <code>GOOGLE_OAUTH_CLIENT_SECRET</code>.
        </p>
      ) : null}
      {(connections?.accounts || []).map((account: CalendarAccount) => (
        <section key={account.accountId}>
          <strong>{account.email}</strong>
          {account.needsReauth ? (
            <button disabled={busy} onClick={() => void connectGoogle()} type="button">
              Reconnect
            </button>
          ) : null}
          <ul>
            {account.calendars.map((cal) => (
              <li key={cal.calendarId}>
                <label>
                  <input
                    checked={cal.selected}
                    onChange={(e) =>
                      void setCalendarSelected(account.accountId, cal.calendarId, e.target.checked)
                    }
                    type="checkbox"
                  />
                  {cal.name}
                  {cal.primary ? " (primary)" : ""}
                </label>
              </li>
            ))}
          </ul>
          <button disabled={busy} onClick={() => void disconnect(account.accountId)} type="button">
            Disconnect
          </button>
        </section>
      ))}
      <button className="dp-cta-btn" disabled={busy} onClick={() => void connectGoogle()} type="button">
        Connect Google
      </button>
      <button disabled title="Coming soon" type="button">
        Connect Outlook · Coming soon
      </button>
    </div>
  );
}
