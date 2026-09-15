/**
 * Google Calendar sync (read) for Fase 1.
 */
import {
  firestoreCreateDocument,
  firestoreGetDocument,
  firestorePatchDocument,
  firestoreRunQuery,
} from "./firestoreAdmin.js";
import { decryptCalendarSecrets, encryptCalendarSecrets } from "./calendarCrypto.js";

const CALENDAR_ACCOUNTS = "calendar_accounts";
const CALENDARS = "calendars";
const CALENDAR_EVENTS = "calendar_events";
const CALENDAR_TOKENS = "calendar_tokens";

function isoDaysFromNow(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

async function queryByField(env, collection, field, value) {
  const result = await firestoreRunQuery(env, {
    from: [{ collectionId: collection }],
    where: {
      fieldFilter: {
        field: { fieldPath: field },
        op: "EQUAL",
        value:
          typeof value === "string"
            ? { stringValue: value }
            : { booleanValue: Boolean(value) },
      },
    },
    limit: 50,
  });
  return result.ok ? result.documents || [] : [];
}

async function refreshGoogleAccess(env, accountId, sealed) {
  const secrets = await decryptCalendarSecrets(env, sealed);
  if (secrets.expiresAt && Date.parse(secrets.expiresAt) > Date.now() + 60_000) {
    return secrets;
  }
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Calendar OAuth is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: secrets.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Could not refresh Google token");
  }
  const next = {
    ...secrets,
    accessToken: String(payload.access_token),
    expiresAt: new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString(),
  };
  const encrypted = await encryptCalendarSecrets(env, next);
  await firestorePatchDocument(env, CALENDAR_TOKENS, accountId, encrypted);
  return next;
}

function mapGoogleEvent(account, calendar, item) {
  const start = item.start?.dateTime || (item.start?.date ? `${item.start.date}T00:00:00.000Z` : null);
  const end = item.end?.dateTime || (item.end?.date ? `${item.end.date}T23:59:59.000Z` : null);
  if (!start || !end || !item.id) return null;
  const meetingUrl =
    item.hangoutLink ||
    item.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    null;
  return {
    id: `${account.id}__${item.id}`,
    userId: account.userId,
    workspaceId: account.workspaceId,
    accountId: account.id,
    calendarId: calendar.id,
    externalId: String(item.id),
    title: String(item.summary || "(No title)"),
    start,
    end,
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
    attendees: Array.isArray(item.attendees)
      ? item.attendees.map((a) => ({
          email: a.email || "",
          displayName: a.displayName || a.email || "",
        }))
      : [],
    location: item.location || null,
    meetingUrl,
    organizer: item.organizer?.email || null,
    status: String(item.status || "confirmed"),
    privacy: calendar.privacy || "full",
    linkedItemId: null,
    linkedProjectId: null,
    linkedNoteId: null,
    certo: null,
    etag: item.etag || null,
    updatedAt: new Date().toISOString(),
  };
}

export async function syncAccount(env, accountId) {
  const account = await firestoreGetDocument(env, CALENDAR_ACCOUNTS, accountId);
  if (!account) return { ok: false, reason: "account_not_found" };
  const tokenDoc = await firestoreGetDocument(env, CALENDAR_TOKENS, accountId);
  if (!tokenDoc?.ciphertext) return { ok: false, reason: "tokens_missing" };
  const secrets = await refreshGoogleAccess(env, accountId, tokenDoc);
  const calendars = (await queryByField(env, CALENDARS, "accountId", accountId)).filter(
    (row) => row.visible !== false,
  );
  let upserted = 0;
  let nextSyncToken = account.syncCursor || null;

  for (const calendar of calendars) {
    const params = new URLSearchParams({
      singleEvents: "true",
      maxResults: "250",
      timeMin: isoDaysFromNow(-30),
      timeMax: isoDaysFromNow(90),
    });
    if (account.syncCursor) params.set("syncToken", account.syncCursor);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.externalId)}/events?${params}`;
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${secrets.accessToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 410) {
      // Invalid sync token — full resync next time.
      await firestorePatchDocument(env, CALENDAR_ACCOUNTS, accountId, { syncCursor: null });
      return syncAccount(env, accountId);
    }
    if (!response.ok) {
      return { ok: false, reason: payload.error?.message || `sync_failed_${response.status}` };
    }
    for (const item of payload.items || []) {
      if (item.status === "cancelled") continue;
      const mapped = mapGoogleEvent(account, calendar, item);
      if (!mapped) continue;
      const existing = await firestoreGetDocument(env, CALENDAR_EVENTS, mapped.id);
      if (existing) {
        await firestorePatchDocument(env, CALENDAR_EVENTS, mapped.id, mapped);
      } else {
        await firestoreCreateDocument(env, CALENDAR_EVENTS, mapped, mapped.id);
      }
      upserted += 1;
    }
    if (payload.nextSyncToken) nextSyncToken = payload.nextSyncToken;
  }

  await firestorePatchDocument(env, CALENDAR_ACCOUNTS, accountId, {
    syncCursor: nextSyncToken,
    status: "ok",
    updatedAt: new Date().toISOString(),
  });
  return { ok: true, upserted, syncCursor: nextSyncToken };
}

export async function registerWatch(env, accountId, calendarId, webhookUrl) {
  const account = await firestoreGetDocument(env, CALENDAR_ACCOUNTS, accountId);
  const calendar = await firestoreGetDocument(env, CALENDARS, calendarId);
  const tokenDoc = await firestoreGetDocument(env, CALENDAR_TOKENS, accountId);
  if (!account || !calendar || !tokenDoc) return { ok: false, reason: "missing" };
  const secrets = await refreshGoogleAccess(env, accountId, tokenDoc);
  const channelId = `cw-${accountId}-${calendarId}-${Date.now()}`;
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.externalId)}/events/watch`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${secrets.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
      }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, reason: payload.error?.message || "watch_failed" };
  }
  const expiresAt = payload.expiration
    ? new Date(Number(payload.expiration)).toISOString()
    : isoDaysFromNow(7);
  await firestorePatchDocument(env, CALENDAR_ACCOUNTS, accountId, {
    pushChannel: { id: channelId, expiresAt, resourceId: payload.resourceId || null },
  });
  return { ok: true, channelId, expiresAt };
}

export async function renewCalendarChannels(env, publicOrigin) {
  const accounts = await queryByField(env, CALENDAR_ACCOUNTS, "status", "ok");
  const soon = Date.now() + 24 * 60 * 60 * 1000;
  let renewed = 0;
  let synced = 0;
  for (const account of accounts) {
    const expires = account.pushChannel?.expiresAt
      ? Date.parse(account.pushChannel.expiresAt)
      : 0;
    const calendars = await queryByField(env, CALENDARS, "accountId", account.id);
    const primary = calendars[0];
    if (!primary) continue;
    if (!expires || expires < soon) {
      const webhook = `${publicOrigin.replace(/\/$/, "")}/api/calendar/webhook/google`;
      const result = await registerWatch(env, account.id, primary.id, webhook);
      if (result.ok) renewed += 1;
      else {
        await syncAccount(env, account.id);
        synced += 1;
      }
    }
  }
  return { ok: true, renewed, synced };
}

export async function exchangeGoogleCode(env, code, redirectUri) {
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Calendar OAuth is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "OAuth exchange failed");
  }
  return payload;
}

export async function fetchGoogleProfile(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return response.json().catch(() => ({}));
}

export async function listGoogleCalendars(accessToken) {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.items) ? payload.items : [];
}

export {
  CALENDAR_ACCOUNTS,
  CALENDARS,
  CALENDAR_EVENTS,
  CALENDAR_TOKENS,
};
