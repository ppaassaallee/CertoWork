export const CALENDAR_ACCOUNTS = "calendar_accounts";
export const CALENDARS = "calendars";
export const CALENDAR_EVENTS = "calendar_events";
export const CALENDAR_TOKENS = "calendar_tokens";

export type CalendarProvider = "google" | "microsoft";

export type CalendarAccountStatus = "ok" | "reauth" | "disconnected";

export type CalendarPrivacy = "full" | "busy";

export type CalendarAccount = {
  id: string;
  userId: string;
  workspaceId: string;
  provider: CalendarProvider;
  email: string;
  displayName: string;
  status: CalendarAccountStatus;
  color?: string | null;
  defaultWriteCalendarId: string | null;
  syncCursor: string | null;
  pushChannel: { id: string; expiresAt: string } | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type Calendar = {
  id: string;
  accountId: string;
  userId: string;
  externalId: string;
  name: string;
  color: string;
  visible: boolean;
  writable: boolean;
  privacy: CalendarPrivacy;
  isWorkTarget: boolean;
  syncToken?: string | null;
  lastSyncAt?: string | null;
  pushChannel?: { id: string; resourceId?: string | null; expiresAt: string } | null;
};

export type CalendarEvent = {
  id: string;
  userId: string;
  workspaceId: string;
  accountId: string;
  calendarId: string;
  externalId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  timeZone?: string | null;
  attendees: Array<{ email?: string; displayName?: string; self?: boolean }>;
  location: string | null;
  meetingUrl: string | null;
  organizer: string | null;
  status: string;
  privacy?: CalendarPrivacy;
  linkedItemId?: string | null;
  linkedProjectId?: string | null;
  linkedNoteId?: string | null;
  certo: { itemId?: string; blockOf?: "plan" | "routine" | "manual" } | null;
  etag?: string | null;
  updatedAt?: string | null;
};

export type TaskScheduled = {
  accountId: string;
  calendarId: string;
  eventId: string;
  start: string;
  end: string;
} | null;
