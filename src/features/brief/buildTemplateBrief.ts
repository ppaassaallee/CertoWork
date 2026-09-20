import type { Brief, BriefInputs } from "./types";

/** Deterministic brief from numbers — never invents data. */
export function buildTemplateBrief(inputs: BriefInputs, uid: string): Brief {
  const parts: Brief["headline"]["parts"] = [];
  const pushText = (text: string) => parts.push({ text, kind: "text" });

  if (inputs.meetingCount > 0) {
    parts.push({
      text: `${inputs.meetingCount} meeting${inputs.meetingCount === 1 ? "" : "s"}`,
      kind: "meetings",
    });
  }
  if (inputs.approvalCount > 0) {
    if (parts.length) pushText(" and ");
    parts.push({
      text: `${inputs.approvalCount} approval${inputs.approvalCount === 1 ? "" : "s"} waiting`,
      kind: "approvals",
    });
  }
  if (inputs.freeAfternoon) {
    if (parts.length) pushText(", but ");
    parts.push({ text: "a free afternoon", kind: "free" });
  }
  if (inputs.overdueCount > 0 && parts.length < 3) {
    if (parts.length) pushText(", and ");
    parts.push({
      text: `${inputs.overdueCount} overdue`,
      kind: "overdue",
    });
  }
  if (!parts.length) {
    pushText("Your day is clear — protect focus.");
  } else if (!parts[0].text.toLowerCase().startsWith("you")) {
    parts.unshift({ text: "You have ", kind: "text" });
    if (!parts[parts.length - 1].text.endsWith(".")) {
      parts.push({ text: ".", kind: "text" });
    }
  }

  const thread = inputs.keyThread || "today's commitments";
  const summary = [
    `Main thread: ${thread}.`,
    inputs.meetingCount
      ? `You have ${inputs.meetingCount} meeting${inputs.meetingCount === 1 ? "" : "s"} on the calendar.`
      : "No meetings blocking deep work.",
    inputs.approvalCount
      ? `${inputs.approvalCount} approval${inputs.approvalCount === 1 ? "" : "s"} need a decision.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const stats: Brief["stats"] = [
    {
      key: "planned",
      label: "Planned today",
      value: inputs.plannedToday,
      href: "/my-work?lens=today",
    },
    {
      key: "overdue",
      label: "Overdue",
      value: inputs.overdueCount,
      tone: inputs.overdueCount > 0 ? "bad" : undefined,
      href: "/my-work?lens=overdue",
    },
    {
      key: "focus",
      label: "Focus score",
      value: inputs.focusScore,
      href: "/my-work",
    },
    {
      key: "blocked",
      label: "Blocked projects",
      value: inputs.blockedProjects,
      tone: inputs.blockedProjects > 0 ? "bad" : undefined,
      href: "/projects",
    },
  ];

  if (inputs.overdueInvoices && inputs.overdueInvoices.count > 0) {
    stats[1] = {
      key: "overdue",
      label: "Overdue",
      value: inputs.overdueCount,
      tone: "bad",
      href: "/my-work?lens=overdue",
    };
  }

  return {
    uid,
    date: inputs.dateKey,
    tz: inputs.tz,
    generatedAt: new Date().toISOString(),
    source: "template",
    headline: { parts },
    summary,
    nextEvent: inputs.nextEvent ?? null,
    meetings: inputs.meetings,
    worthNoting: inputs.worthNoting.slice(0, 4),
    stats,
    schedule: inputs.schedule,
    audio: null,
    inputsHash: hashInputs(inputs),
  };
}

export function hashInputs(inputs: BriefInputs): string {
  const payload = JSON.stringify({
    d: inputs.dateKey,
    m: inputs.meetingCount,
    a: inputs.approvalCount,
    o: inputs.overdueCount,
    p: inputs.plannedToday,
    f: inputs.focusScore,
    b: inputs.blockedProjects,
    free: inputs.freeAfternoon,
    inv: inputs.overdueInvoices,
    meetings: inputs.meetings.map((x) => x.eventKey),
    note: inputs.worthNoting.map((w) => w.text),
  });
  let h = 0;
  for (let i = 0; i < payload.length; i++) h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0;
  return `h${Math.abs(h).toString(36)}`;
}

/** Reject LLM prose that introduces numbers absent from the template inputs. */
export function validateBriefNumbers(brief: Brief, inputs: BriefInputs): boolean {
  const allowed = new Set<string>([
    String(inputs.meetingCount),
    String(inputs.approvalCount),
    String(inputs.overdueCount),
    String(inputs.plannedToday),
    String(inputs.focusScore),
    String(inputs.blockedProjects),
  ]);
  if (inputs.overdueInvoices) {
    allowed.add(String(inputs.overdueInvoices.count));
    allowed.add(String(inputs.overdueInvoices.sum));
  }
  const blob = [
    brief.summary,
    ...brief.headline.parts.map((p) => p.text),
    ...brief.worthNoting.map((w) => w.text),
    ...brief.schedule.map((s) => s.text),
  ].join(" ");
  const nums = blob.match(/\d[\d,]*/g) || [];
  for (const n of nums) {
    const clean = n.replace(/,/g, "");
    if (!allowed.has(clean)) {
      const val = Number(clean);
      // Allow clock-ish / day-of-month numbers; reject invented large figures
      if (Number.isFinite(val) && val > 31) return false;
    }
  }
  return true;
}
