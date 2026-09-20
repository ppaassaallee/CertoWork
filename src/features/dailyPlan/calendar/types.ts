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

export type CalendarAccount = {
  accountId: string;
  provider: "google" | "outlook";
  email: string;
  displayName: string;
  scopes: string[];
  calendars: Array<{
    calendarId: string;
    name: string;
    color?: string;
    selected: boolean;
    primary: boolean;
  }>;
  connectedAt: string;
  needsReauth?: boolean;
};

export type CalendarConnections = {
  uid: string;
  accounts: CalendarAccount[];
  defaultWriteAccountId?: string | null;
  autoSyncBlocks?: boolean;
  updatedAt?: unknown;
};
