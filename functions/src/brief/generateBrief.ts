import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

type BriefInputs = {
  dateKey: string;
  tz: string;
  meetingCount: number;
  approvalCount: number;
  freeAfternoon: boolean;
  overdueCount: number;
  plannedToday: number;
  focusScore: number | string;
  blockedProjects: number;
  meetings: Array<{
    eventKey: string;
    title: string;
    start: string;
    end: string;
    provider?: string;
  }>;
  nextEvent?: {
    eventKey: string;
    title: string;
    start: string;
    end: string;
    relatedItemIds: string[];
    provider?: string;
  } | null;
  worthNoting: Array<{
    text: string;
    entities: Array<{ type: string; id: string; label: string }>;
    severity: "info" | "warn" | "bad";
  }>;
  schedule: Array<{
    text: string;
    entities: Array<{ type: string; id: string; label: string }>;
  }>;
  keyThread?: string;
};

function hashInputs(inputs: BriefInputs): string {
  const payload = JSON.stringify({
    d: inputs.dateKey,
    m: inputs.meetingCount,
    a: inputs.approvalCount,
    o: inputs.overdueCount,
    p: inputs.plannedToday,
    f: inputs.focusScore,
    b: inputs.blockedProjects,
  });
  let h = 0;
  for (let i = 0; i < payload.length; i++) h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0;
  return `h${Math.abs(h).toString(36)}`;
}

function buildTemplate(uid: string, inputs: BriefInputs) {
  const parts: Array<{ text: string; kind?: string }> = [];
  if (inputs.meetingCount > 0) {
    parts.push({
      text: `${inputs.meetingCount} meeting${inputs.meetingCount === 1 ? "" : "s"}`,
      kind: "meetings",
    });
  }
  if (inputs.approvalCount > 0) {
    if (parts.length) parts.push({ text: " and ", kind: "text" });
    parts.push({
      text: `${inputs.approvalCount} approval${inputs.approvalCount === 1 ? "" : "s"} waiting`,
      kind: "approvals",
    });
  }
  if (inputs.freeAfternoon) {
    if (parts.length) parts.push({ text: ", but ", kind: "text" });
    parts.push({ text: "a free afternoon", kind: "free" });
  }
  if (!parts.length) parts.push({ text: "Your day is clear — protect focus.", kind: "text" });
  else {
    parts.unshift({ text: "You have ", kind: "text" });
    parts.push({ text: ".", kind: "text" });
  }

  return {
    uid,
    date: inputs.dateKey,
    tz: inputs.tz,
    source: "template" as const,
    headline: { parts },
    summary: `Main thread: ${inputs.keyThread || "today's commitments"}.`,
    nextEvent: inputs.nextEvent ?? null,
    meetings: inputs.meetings || [],
    worthNoting: (inputs.worthNoting || []).slice(0, 4),
    stats: [
      { key: "planned", label: "Planned today", value: inputs.plannedToday, href: "/my-work" },
      {
        key: "overdue",
        label: "Overdue",
        value: inputs.overdueCount,
        tone: inputs.overdueCount > 0 ? "bad" : undefined,
        href: "/my-work",
      },
      { key: "focus", label: "Focus score", value: inputs.focusScore, href: "/my-work" },
      {
        key: "blocked",
        label: "Blocked projects",
        value: inputs.blockedProjects,
        href: "/projects",
      },
    ],
    schedule: inputs.schedule || [],
    audio: null,
    inputsHash: hashInputs(inputs),
  };
}

/**
 * Callable generateBrief — template-first. Client may pass pre-gathered inputs;
 * server never invents meetings/amounts. LLM polish is optional (not wired here).
 */
export const generateBrief = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  const uid = request.auth.uid;
  const data = (request.data || {}) as {
    dateKey?: string;
    tz?: string;
    force?: boolean;
    inputs?: BriefInputs;
  };
  const dateKey = data.dateKey || new Date().toISOString().slice(0, 10);
  const tz = data.tz || "UTC";
  const db = getFirestore();
  const ref = db.doc(`briefs/${uid}_${dateKey}`);

  const inputs: BriefInputs = data.inputs || {
    dateKey,
    tz,
    meetingCount: 0,
    approvalCount: 0,
    freeAfternoon: true,
    overdueCount: 0,
    plannedToday: 0,
    focusScore: "—",
    blockedProjects: 0,
    meetings: [],
    worthNoting: [],
    schedule: [],
  };
  inputs.dateKey = dateKey;
  inputs.tz = tz;

  const hash = hashInputs(inputs);
  if (!data.force) {
    const existing = await ref.get();
    if (existing.exists && existing.data()?.inputsHash === hash) {
      return existing.data();
    }
  }

  const brief = buildTemplate(uid, inputs);
  await ref.set({ ...brief, generatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return brief;
});
