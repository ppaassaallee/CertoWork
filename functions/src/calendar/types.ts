export interface CalEvent {
  eventKey: string;
  accountId: string;
  calendarId: string;
  eventId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  attendeesCount: number;
  meetingLink?: string | null;
  htmlLink?: string | null;
  isOrganizer: boolean;
  createdByCerto: boolean;
  certoItemId?: string | null;
}

export interface CalendarProvider {
  exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<{ refreshToken: string; email: string; displayName: string; scopes: string[] }>;
  listCalendars(
    refreshToken: string,
  ): Promise<Array<{ calendarId: string; name: string; color?: string; primary: boolean }>>;
  listEvents(
    refreshToken: string,
    calendarIds: string[],
    fromISO: string,
    toISO: string,
  ): Promise<CalEvent[]>;
  createEvent(
    refreshToken: string,
    calendarId: string,
    e: { title: string; start: string; end: string; description?: string; itemId?: string },
  ): Promise<{ eventId: string; htmlLink?: string }>;
  updateEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
    e: { title?: string; start?: string; end?: string },
  ): Promise<void>;
  deleteEvent(refreshToken: string, calendarId: string, eventId: string): Promise<void>;
}
