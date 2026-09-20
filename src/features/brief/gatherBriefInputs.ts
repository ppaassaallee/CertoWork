import type { BriefInputs } from "./types";

export type GatherBriefArgs = {
  dateKey: string;
  tz: string;
  meetings?: Array<{
    eventKey: string;
    title: string;
    start: string;
    end: string;
    provider?: string;
  }>;
  approvalCount?: number;
  overdueCount?: number;
  plannedToday?: number;
  focusScore?: number | string;
  blockedProjects?: number;
  freeAfternoon?: boolean;
  keyThread?: string;
  worthNoting?: BriefInputs["worthNoting"];
  schedule?: BriefInputs["schedule"];
  overdueInvoices?: BriefInputs["overdueInvoices"];
  relatedItemIds?: string[];
};

/** Client-side gather — omits missing sources instead of crashing. */
export function gatherBriefInputs(args: GatherBriefArgs): BriefInputs {
  const meetings = args.meetings || [];
  const sorted = [...meetings].sort((a, b) => a.start.localeCompare(b.start));
  const next = sorted[0];
  return {
    dateKey: args.dateKey,
    tz: args.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    meetingCount: meetings.length,
    approvalCount: args.approvalCount ?? 0,
    freeAfternoon: args.freeAfternoon ?? meetings.length <= 2,
    overdueCount: args.overdueCount ?? 0,
    plannedToday: args.plannedToday ?? 0,
    focusScore: args.focusScore ?? "—",
    blockedProjects: args.blockedProjects ?? 0,
    meetings: sorted,
    nextEvent: next
      ? {
          eventKey: next.eventKey,
          title: next.title,
          start: next.start,
          end: next.end,
          relatedItemIds: args.relatedItemIds || [],
          provider: next.provider,
        }
      : null,
    worthNoting: args.worthNoting || [],
    schedule: args.schedule || [],
    overdueInvoices: args.overdueInvoices,
    keyThread: args.keyThread,
  };
}
