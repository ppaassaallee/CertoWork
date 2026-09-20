import { createHash } from "crypto";
import { google } from "googleapis";
import type { CalendarProvider, CalEvent } from "./types";

function oauthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    const err = new Error("calendar-not-configured");
    (err as Error & { code: string }).code = "failed-precondition";
    throw err;
  }
  return new google.auth.OAuth2(clientId, clientSecret);
}

export function accountIdFor(provider: string, email: string) {
  return `${provider}:${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24)}`;
}

export const googleProvider: CalendarProvider = {
  async exchangeCode(code, redirectUri) {
    const client = oauthClient();
    client.redirectUri = redirectUri;
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) throw new Error("No refresh token — re-consent required");
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    return {
      refreshToken: tokens.refresh_token,
      email: String(me.data.email || ""),
      displayName: String(me.data.name || me.data.email || ""),
      scopes: String(tokens.scope || "").split(/\s+/).filter(Boolean),
    };
  },

  async listCalendars(refreshToken) {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const cal = google.calendar({ version: "v3", auth: client });
    const res = await cal.calendarList.list();
    return (res.data.items || []).map((item) => ({
      calendarId: String(item.id),
      name: String(item.summary || item.id),
      color: item.backgroundColor || undefined,
      primary: Boolean(item.primary),
    }));
  },

  async listEvents(refreshToken, calendarIds, fromISO, toISO) {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const cal = google.calendar({ version: "v3", auth: client });
    const out: CalEvent[] = [];
    for (const calendarId of calendarIds) {
      const res = await cal.events.list({
        calendarId,
        timeMin: fromISO,
        timeMax: toISO,
        singleEvents: true,
        orderBy: "startTime",
      });
      for (const ev of res.data.items || []) {
        const eventId = String(ev.id || "");
        const accountId = ""; // filled by caller
        out.push({
          eventKey: `:${calendarId}:${eventId}`,
          accountId,
          calendarId,
          eventId,
          title: String(ev.summary || "(No title)"),
          start: String(ev.start?.dateTime || ev.start?.date || ""),
          end: String(ev.end?.dateTime || ev.end?.date || ""),
          allDay: Boolean(ev.start?.date && !ev.start?.dateTime),
          attendeesCount: (ev.attendees || []).length,
          meetingLink: ev.hangoutLink || null,
          htmlLink: ev.htmlLink || null,
          isOrganizer: Boolean(ev.organizer?.self),
          createdByCerto: ev.extendedProperties?.private?.certo === "1",
          certoItemId: ev.extendedProperties?.private?.certoItemId || null,
        });
      }
    }
    return out;
  },

  async createEvent(refreshToken, calendarId, e) {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const cal = google.calendar({ version: "v3", auth: client });
    const res = await cal.events.insert({
      calendarId,
      requestBody: {
        summary: e.title,
        description: e.description,
        start: { dateTime: e.start },
        end: { dateTime: e.end },
        extendedProperties: {
          private: { certo: "1", certoItemId: e.itemId || "" },
        },
      },
    });
    return { eventId: String(res.data.id), htmlLink: res.data.htmlLink || undefined };
  },

  async updateEvent(refreshToken, calendarId, eventId, e) {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const cal = google.calendar({ version: "v3", auth: client });
    await cal.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary: e.title,
        start: e.start ? { dateTime: e.start } : undefined,
        end: e.end ? { dateTime: e.end } : undefined,
      },
    });
  },

  async deleteEvent(refreshToken, calendarId, eventId) {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const cal = google.calendar({ version: "v3", auth: client });
    await cal.events.delete({ calendarId, eventId });
  },
};
