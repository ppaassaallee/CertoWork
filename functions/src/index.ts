import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { accountIdFor, googleProvider } from "./calendar/googleProvider";
import type { CalEvent } from "./calendar/types";

initializeApp();
const db = getFirestore();

function requireAuth(uid?: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");
}

function notConfigured(): never {
  throw new HttpsError("failed-precondition", "calendar-not-configured");
}

export const calendarConnect = onCall({ region: "us-central1" }, async (request) => {
  requireAuth(request.auth?.uid);
  const uid = request.auth!.uid;
  const { provider, code, redirectUri } = request.data as {
    provider: "google" | "outlook";
    code: string;
    redirectUri: string;
  };
  if (provider !== "google") {
    throw new HttpsError("unimplemented", "Outlook connect arrives in Phase 3");
  }
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    notConfigured();
  }
  try {
    const exchanged = await googleProvider.exchangeCode(code, redirectUri);
    const accountId = accountIdFor("google", exchanged.email);
    await db.doc(`calendarTokens/${accountId}`).set(
      {
        uid,
        provider: "google",
        refreshToken: exchanged.refreshToken,
        scopes: exchanged.scopes,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    const calendars = await googleProvider.listCalendars(exchanged.refreshToken);
    const account = {
      accountId,
      provider: "google" as const,
      email: exchanged.email,
      displayName: exchanged.displayName,
      scopes: exchanged.scopes,
      calendars: calendars.map((c) => ({
        ...c,
        selected: c.primary,
      })),
      connectedAt: new Date().toISOString(),
      needsReauth: false,
    };
    const connRef = db.doc(`calendarConnections/${uid}`);
    const snap = await connRef.get();
    const accounts = snap.exists ? [...((snap.data()?.accounts as any[]) || [])] : [];
    const idx = accounts.findIndex((a) => a.accountId === accountId);
    if (idx >= 0) accounts[idx] = { ...accounts[idx], ...account };
    else accounts.push(account);
    await connRef.set(
      {
        uid,
        accounts,
        defaultWriteAccountId: snap.data()?.defaultWriteAccountId || accountId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { account };
  } catch (err) {
    if (err instanceof Error && err.message === "calendar-not-configured") notConfigured();
    throw new HttpsError("internal", err instanceof Error ? err.message : "Connect failed");
  }
});

export const calendarDisconnect = onCall({ region: "us-central1" }, async (request) => {
  requireAuth(request.auth?.uid);
  const uid = request.auth!.uid;
  const { accountId } = request.data as { accountId: string };
  await db.doc(`calendarTokens/${accountId}`).delete().catch(() => undefined);
  const connRef = db.doc(`calendarConnections/${uid}`);
  const snap = await connRef.get();
  if (!snap.exists) return { ok: true };
  const accounts = ((snap.data()?.accounts as any[]) || []).filter((a) => a.accountId !== accountId);
  await connRef.set(
    {
      accounts,
      defaultWriteAccountId:
        snap.data()?.defaultWriteAccountId === accountId
          ? accounts[0]?.accountId || null
          : snap.data()?.defaultWriteAccountId || null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true };
});

export const calendarListEvents = onCall({ region: "us-central1" }, async (request) => {
  requireAuth(request.auth?.uid);
  const uid = request.auth!.uid;
  const { dateKey, tz } = request.data as { dateKey: string; tz: string };
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    notConfigured();
  }
  const conn = await db.doc(`calendarConnections/${uid}`).get();
  const accounts = (conn.data()?.accounts as any[]) || [];
  const events: CalEvent[] = [];
  const errors: Array<{ accountId: string; code: string }> = [];
  const from = new Date(`${dateKey}T00:00:00`);
  const to = new Date(`${dateKey}T23:59:59`);
  // tz is informational for clients; server uses local ISO of dateKey
  void tz;
  for (const account of accounts) {
    try {
      const tokenSnap = await db.doc(`calendarTokens/${account.accountId}`).get();
      if (!tokenSnap.exists) {
        errors.push({ accountId: account.accountId, code: "missing-token" });
        continue;
      }
      const refreshToken = String(tokenSnap.data()?.refreshToken || "");
      const selected = (account.calendars || [])
        .filter((c: any) => c.selected)
        .map((c: any) => String(c.calendarId));
      if (!selected.length) continue;
      const listed = await googleProvider.listEvents(
        refreshToken,
        selected,
        from.toISOString(),
        to.toISOString(),
      );
      for (const ev of listed) {
        events.push({
          ...ev,
          accountId: account.accountId,
          eventKey: `${account.accountId}:${ev.calendarId}:${ev.eventId}`,
        });
      }
    } catch (err) {
      const code = err instanceof Error && /invalid_grant/i.test(err.message) ? "invalid_grant" : "list-failed";
      if (code === "invalid_grant") {
        account.needsReauth = true;
      }
      errors.push({ accountId: account.accountId, code });
    }
  }
  if (accounts.some((a) => a.needsReauth)) {
    await db.doc(`calendarConnections/${uid}`).set({ accounts, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  events.sort((a, b) => a.start.localeCompare(b.start));
  return { events, errors };
});

export const calendarCreateEvent = onCall({ region: "us-central1" }, async () => {
  throw new HttpsError("unimplemented", "not-implemented");
});
export const calendarUpdateEvent = onCall({ region: "us-central1" }, async () => {
  throw new HttpsError("unimplemented", "not-implemented");
});
export const calendarDeleteEvent = onCall({ region: "us-central1" }, async () => {
  throw new HttpsError("unimplemented", "not-implemented");
});

export { dailyPlanRoutinesTick } from "./calendar/routines";
export { generateBrief } from "./brief/generateBrief";
export { dailyBriefRoutineTick } from "./brief/dailyBriefRoutine";
export { signalRoutinesTick } from "./signals/signalRoutines";
export { allocateInvoiceNumber, flipOverdueInvoices, generateProjectInvoices } from "./billing/invoiceFns";
