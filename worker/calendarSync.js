/**
 * Google Calendar sync (read) — per-calendar sync tokens, deletions, push.
 * Calendars are personal: every doc is scoped by userId.
 */
import {
  firestoreDeleteDocument,
  firestoreGetDocument,
  firestorePatchDocument,
  firestoreRunQuery,
  firestoreUpsertDocument,
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

async function queryByField(env, collection, field, value, limit = 100) {
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
    limit,
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

async function listGoogleEventsPage(accessToken, externalCalendarId, params) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(externalCalendarId)}/events?${params}`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, payload };
}

function mapGoogleEvent(account, calendar, item) {
  const allDay = Boolean(item.start?.date && !item.start?.dateTime);
  const start = allDay ? item.start.date : item.start?.dateTime;
  const end = allDay ? item.end?.date : item.end?.dateTime;
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
    allDay,
    timeZone: item.start?.timeZone || null,
    attendees: Array.isArray(item.attendees)
      ? item.attendees.map((a) => ({
          email: a.email || "",
          displayName: a.displayName || a.email || "",
          self: Boolean(a.self),
        }))
      : [],
    location: item.location || null,
    meetingUrl,
    organizer: item.organizer?.email || null,
    status: String(item.status || "confirmed"),
    linkedItemId: null,
    linkedProjectId: null,
    linkedNoteId: null,
    certo: null,
    etag: item.etag || null,
    updatedAt: new Date().toISOString(),
  };
}

export async function syncCalendar(env, account, calendar, secrets) {
  let upserted = 0;
  let deleted = 0;
  let pageToken = null;
  let syncToken = calendar.syncToken || null;
  let nextSyncToken = null;

  do {
    const params = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
    if (syncToken) {
      params.set("syncToken", syncToken);
      params.set("showDeleted", "true");
    } else {
      params.set("timeMin", isoDaysFromNow(-30));
      params.set("timeMax", isoDaysFromNow(90));
    }
    if (pageToken) params.set("pageToken", pageToken);

    const { status, ok, payload } = await listGoogleEventsPage(
      secrets.accessToken,
      calendar.externalId,
      params,
    );
    if (status === 410) {
      await firestorePatchDocument(env, CALENDARS, calendar.id, { syncToken: null });
      return syncCalendar(env, account, { ...calendar, syncToken: null }, secrets);
    }
    if (!ok) return { ok: false, reason: payload.error?.message || `sync_failed_${status}` };

    for (const item of payload.items || []) {
      const docId = `${account.id}__${item.id}`;
      if (item.status === "cancelled") {
        await firestoreDeleteDocument(env, CALENDAR_EVENTS, docId).catch(() => {});
        deleted += 1;
        continue;
      }
      const mapped = mapGoogleEvent(account, calendar, item);
      if (!mapped) continue;
      // Preserve link fields if the event already exists.
      const existing = await firestoreGetDocument(env, CALENDAR_EVENTS, docId);
      if (existing) {
        mapped.linkedItemId = existing.linkedItemId || null;
        mapped.linkedProjectId = existing.linkedProjectId || null;
        mapped.linkedNoteId = existing.linkedNoteId || null;
        mapped.certo = existing.certo || null;
      }
      await firestoreUpsertDocument(env, CALENDAR_EVENTS, docId, mapped);
      upserted += 1;
    }
    pageToken = payload.nextPageToken || null;
    if (payload.nextSyncToken) nextSyncToken = payload.nextSyncToken;
  } while (pageToken);

  if (nextSyncToken) {
    await firestorePatchDocument(env, CALENDARS, calendar.id, {
      syncToken: nextSyncToken,
      lastSyncAt: new Date().toISOString(),
    });
  }
  return { ok: true, upserted, deleted, calendarId: calendar.id };
}

export async function syncAccount(env, accountId) {
  const account = await firestoreGetDocument(env, CALENDAR_ACCOUNTS, accountId);
  if (!account) return { ok: false, reason: "account_not_found" };
  if (account.status === "disconnected") return { ok: false, reason: "disconnected" };
  const tokenDoc = await firestoreGetDocument(env, CALENDAR_TOKENS, accountId);
  if (!tokenDoc?.ciphertext) return { ok: false, reason: "tokens_missing" };
  let secrets;
  try {
    secrets = await refreshGoogleAccess(env, accountId, tokenDoc);
  } catch (error) {
    await firestorePatchDocument(env, CALENDAR_ACCOUNTS, accountId, {
      status: "reauth",
      lastError: String(error?.message || error),
      updatedAt: new Date().toISOString(),
    });
    return { ok: false, reason: "reauth_required" };
  }
  const calendars = (await queryByField(env, CALENDARS, "accountId", accountId)).filter(
    (row) => row.visible !== false,
  );
  const results = [];
  for (const calendar of calendars) {
    results.push(await syncCalendar(env, account, calendar, secrets));
  }
  const failed = results.find((r) => !r.ok);
  await firestorePatchDocument(env, CALENDAR_ACCOUNTS, accountId, {
    status: failed ? "error" : "ok",
    lastError: failed ? failed.reason : null,
    lastSyncAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: !failed, results };
}

async function stopWatch(env, secrets, channel) {
  if (!channel?.id || !channel?.resourceId) return;
  await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secrets.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ id: channel.id, resourceId: channel.resourceId }),
  }).catch(() => {});
}

export async function registerWatch(env, accountId, calendarId, webhookUrl) {
  const account = await firestoreGetDocument(env, CALENDAR_ACCOUNTS, accountId);
  const calendar = await firestoreGetDocument(env, CALENDARS, calendarId);
  const tokenDoc = await firestoreGetDocument(env, CALENDAR_TOKENS, accountId);
  if (!account || !calendar || !tokenDoc) return { ok: false, reason: "missing" };
  const secrets = await refreshGoogleAccess(env, accountId, tokenDoc);
  if (calendar.pushChannel?.id) {
    await stopWatch(env, secrets, calendar.pushChannel);
  }
  const channelId = `cw-${accountId}-${calendarId}-${Date.now()}`;
  const body = {
    id: channelId,
    type: "web_hook",
    address: webhookUrl,
  };
  if (env.CALENDAR_WEBHOOK_TOKEN) {
    body.token = String(env.CALENDAR_WEBHOOK_TOKEN);
  }
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.externalId)}/events/watch`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${secrets.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, reason: payload.error?.message || "watch_failed" };
  }
  const expiresAt = payload.expiration
    ? new Date(Number(payload.expiration)).toISOString()
    : isoDaysFromNow(7);
  await firestorePatchDocument(env, CALENDARS, calendarId, {
    pushChannel: {
      id: channelId,
      expiresAt,
      resourceId: payload.resourceId || null,
    },
  });
  return { ok: true, channelId, expiresAt };
}

export async function renewCalendarChannels(env, publicOrigin) {
  const accounts = await queryByField(env, CALENDAR_ACCOUNTS, "status", "ok");
  const soon = Date.now() + 24 * 60 * 60 * 1000;
  let renewed = 0;
  let synced = 0;
  for (const account of accounts) {
    const calendars = (await queryByField(env, CALENDARS, "accountId", account.id)).filter(
      (row) => row.visible !== false,
    );
    for (const calendar of calendars) {
      const expires = calendar.pushChannel?.expiresAt
        ? Date.parse(calendar.pushChannel.expiresAt)
        : 0;
      if (expires && expires >= soon) continue;
      const webhook = `${publicOrigin.replace(/\/$/, "")}/api/calendar/webhook/google`;
      const result = await registerWatch(env, account.id, calendar.id, webhook);
      if (result.ok) renewed += 1;
      else {
        await syncAccount(env, account.id);
        synced += 1;
        break;
      }
    }
  }
  return { ok: true, renewed, synced };
}

export async function disconnectAccount(env, accountId) {
  const account = await firestoreGetDocument(env, CALENDAR_ACCOUNTS, accountId);
  if (!account) return { ok: false, reason: "account_not_found" };
  const tokenDoc = await firestoreGetDocument(env, CALENDAR_TOKENS, accountId);
  let secrets = null;
  if (tokenDoc?.ciphertext) {
    try {
      secrets = await decryptCalendarSecrets(env, tokenDoc);
      if (secrets.refreshToken || secrets.accessToken) {
        const token = secrets.refreshToken || secrets.accessToken;
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
          { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } },
        ).catch(() => {});
      }
      if (secrets.accessToken) {
        const calendars = await queryByField(env, CALENDARS, "accountId", accountId);
        for (const calendar of calendars) {
          if (calendar.pushChannel) await stopWatch(env, secrets, calendar.pushChannel);
        }
      }
    } catch {
      /* still wipe local state */
    }
  }
  const events = await queryByField(env, CALENDAR_EVENTS, "accountId", accountId, 200);
  for (const event of events) {
    await firestoreDeleteDocument(env, CALENDAR_EVENTS, event.id).catch(() => {});
  }
  // Second pass if more than 200
  const more = await queryByField(env, CALENDAR_EVENTS, "accountId", accountId, 200);
  for (const event of more) {
    await firestoreDeleteDocument(env, CALENDAR_EVENTS, event.id).catch(() => {});
  }
  const calendars = await queryByField(env, CALENDARS, "accountId", accountId);
  for (const calendar of calendars) {
    await firestoreDeleteDocument(env, CALENDARS, calendar.id).catch(() => {});
  }
  await firestoreDeleteDocument(env, CALENDAR_TOKENS, accountId).catch(() => {});
  await firestorePatchDocument(env, CALENDAR_ACCOUNTS, accountId, {
    status: "disconnected",
    pushChannel: null,
    lastError: null,
    disconnectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
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
  mapGoogleEvent,
  queryByField,
  refreshGoogleAccess,
};
