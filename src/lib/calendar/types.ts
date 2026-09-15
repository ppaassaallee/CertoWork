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
  defaultWriteCalendarId: string | null;
  syncCursor: string | null;
  pushChannel: { id: string; expiresAt: string } | null;
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
  attendees: Array<{ email?: string; displayName?: string }>;
  location: string | null;
  meetingUrl: string | null;
  organizer: string | null;
  status: string;
  privacy: CalendarPrivacy;
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
