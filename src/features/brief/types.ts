export type BriefEntityType = "user" | "project" | "item" | "invoice" | "client";

export type BriefHeadlineKind =
  | "meetings"
  | "approvals"
  | "free"
  | "overdue"
  | "invoices"
  | "text";

export type BriefHeadlinePart = {
  text: string;
  kind?: BriefHeadlineKind;
};

export type BriefEntity = {
  type: BriefEntityType | string;
  id: string;
  label: string;
};

export type Brief = {
  uid: string;
  date: string;
  tz: string;
  generatedAt: unknown;
  source: "llm" | "template";
  headline: { parts: BriefHeadlinePart[] };
  summary: string;
  nextEvent?: {
    eventKey: string;
    title: string;
    start: string;
    end: string;
    link?: string;
    relatedItemIds: string[];
    provider?: string;
  } | null;
  meetings: Array<{
    eventKey: string;
    title: string;
    start: string;
    end: string;
    provider?: string;
  }>;
  worthNoting: Array<{
    text: string;
    entities: BriefEntity[];
    severity: "info" | "warn" | "bad";
  }>;
  stats: Array<{
    key: string;
    label: string;
    value: string | number;
    tone?: "bad";
    href: string;
  }>;
  schedule: Array<{ text: string; entities: BriefEntity[] }>;
  audio?: { url: string; seconds: number } | null;
  inputsHash: string;
};

export type BriefInputs = {
  dateKey: string;
  tz: string;
  meetingCount: number;
  approvalCount: number;
  freeAfternoon: boolean;
  overdueCount: number;
  plannedToday: number;
  focusScore: number | string;
  blockedProjects: number;
  meetings: Brief["meetings"];
  nextEvent?: Brief["nextEvent"];
  worthNoting: Brief["worthNoting"];
  schedule: Brief["schedule"];
  overdueInvoices?: { count: number; sum: number; clients: string[] };
  keyThread?: string;
};
