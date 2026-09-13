import { addDays, format, nextDay, parse, isValid, type Day } from "date-fns";
import { es, enUS } from "date-fns/locale";
import {
  isAssignableMember,
  memberMatchesSelection,
  memberPublicLabel,
  type WorkspaceMember,
} from "../../lib/workspaceCollaboration";
import { assignmentFieldsFromMembers } from "../../lib/taskAssignment";

export type CaptureWorkType =
  | "epic"
  | "feature"
  | "pbi"
  | "story"
  | "task"
  | "bug"
  | "subtask";

export type CapturePriority = "1" | "2" | "3" | null;

export type TitleToken =
  | { kind: "type"; value: CaptureWorkType; raw: string }
  | { kind: "person"; value: string; memberId?: string; raw: string }
  | { kind: "priority"; value: CapturePriority; label: string; raw: string }
  | { kind: "date"; value: string; label: string; raw: string };

export type ParsedCaptureTitle = {
  cleanTitle: string;
  tokens: TitleToken[];
  workItemType: CaptureWorkType | null;
  priority: CapturePriority;
  dueDate: string | null;
  assigneeMemberId: string | null;
  assigneeLabel: string | null;
  assignmentPatch: Record<string, unknown>;
};

const TYPE_MAP: Record<string, CaptureWorkType> = {
  bug: "bug",
  bugs: "bug",
  pbi: "pbi",
  story: "story",
  epic: "epic",
  feature: "feature",
  task: "task",
  tarea: "task",
  subtask: "subtask",
  subtarea: "subtask",
  ticket: "task",
};

const PRIORITY_MAP: Record<string, { value: CapturePriority; label: string }> = {
  p1: { value: "1", label: "P1 · Crítica" },
  critica: { value: "1", label: "P1 · Crítica" },
  crítica: { value: "1", label: "P1 · Crítica" },
  critical: { value: "1", label: "P1 · Critical" },
  "1": { value: "1", label: "P1" },
  alta: { value: "2", label: "P2 · Alta" },
  high: { value: "2", label: "P2 · High" },
  p2: { value: "2", label: "P2 · Alta" },
  "2": { value: "2", label: "P2" },
  media: { value: "3", label: "P3 · Media" },
  medium: { value: "3", label: "P3 · Medium" },
  p3: { value: "3", label: "P3 · Media" },
  "3": { value: "3", label: "P3" },
  baja: { value: "3", label: "P4 · Baja" },
  low: { value: "3", label: "P4 · Low" },
  p4: { value: "3", label: "P4 · Baja" },
};

const WEEKDAY: Record<string, Day> = {
  domingo: 0,
  sunday: 0,
  lunes: 1,
  monday: 1,
  martes: 2,
  tuesday: 2,
  miercoles: 3,
  miércoles: 3,
  wednesday: 3,
  jueves: 4,
  thursday: 4,
  viernes: 5,
  friday: 5,
  sabado: 6,
  sábado: 6,
  saturday: 6,
};

function normalizeToken(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseNaturalDate(raw: string, now = new Date()): string | null {
  const text = normalizeToken(raw);
  if (!text) return null;
  if (text === "hoy" || text === "today") return format(now, "yyyy-MM-dd");
  if (text === "manana" || text === "tomorrow") return format(addDays(now, 1), "yyyy-MM-dd");
  const inDays = text.match(/^(?:en|in)\s+(\d+)\s+d(?:ias|ays)?$/);
  if (inDays) return format(addDays(now, Number(inDays[1])), "yyyy-MM-dd");
  if (WEEKDAY[text] != null) {
    const day = WEEKDAY[text];
    const next = nextDay(now, day);
    // If today is that weekday, nextDay jumps a week — prefer today when same day
    if (now.getDay() === day) return format(now, "yyyy-MM-dd");
    return format(next, "yyyy-MM-dd");
  }
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (iso) return iso[1];
  for (const locale of [es, enUS]) {
    for (const pattern of ["d MMM", "d MMMM", "MMM d", "MMMM d", "d/M", "d/M/yyyy"]) {
      const parsed = parse(raw.trim(), pattern, now, { locale });
      if (isValid(parsed)) {
        if (parsed.getFullYear() < now.getFullYear() - 1) {
          parsed.setFullYear(now.getFullYear());
        }
        return format(parsed, "yyyy-MM-dd");
      }
    }
  }
  return null;
}

function matchMember(query: string, members: WorkspaceMember[]) {
  const cleaned = query.replace(/^@/, "").trim();
  if (!cleaned) return null;
  const pool = members.filter((member) => isAssignableMember(member));
  const exact = pool.find((member) => memberMatchesSelection(member, [], [cleaned]));
  if (exact) return exact;
  const lower = cleaned.toLowerCase();
  return (
    pool.find((member) =>
      [member.alias, member.displayName, member.email, memberPublicLabel(member)]
        .filter(Boolean)
        .some((label) => String(label).toLowerCase().startsWith(lower)),
    ) || null
  );
}

/**
 * Parse a capture title line: `#bug @César mañana !alta Fix timeout`
 * Tokens become chips; remaining words are the clean title.
 */
export function parseCaptureTitle(
  input: string,
  members: WorkspaceMember[] = [],
  now = new Date(),
): ParsedCaptureTitle {
  const source = String(input || "").replace(/\s+/g, " ").trim();
  if (!source) {
    return {
      cleanTitle: "",
      tokens: [],
      workItemType: null,
      priority: null,
      dueDate: null,
      assigneeMemberId: null,
      assigneeLabel: null,
      assignmentPatch: {},
    };
  }

  const parts = source.split(" ").filter(Boolean);
  const tokens: TitleToken[] = [];
  const titleParts: string[] = [];
  let workItemType: CaptureWorkType | null = null;
  let priority: CapturePriority = null;
  let dueDate: string | null = null;
  let assigneeMemberId: string | null = null;
  let assigneeLabel: string | null = null;
  let assignmentPatch: Record<string, unknown> = {};

  for (const part of parts) {
    if (/^#[\w-]+$/i.test(part)) {
      const key = normalizeToken(part.slice(1));
      const mapped = TYPE_MAP[key];
      if (mapped) {
        workItemType = mapped;
        tokens.push({ kind: "type", value: mapped, raw: part });
        continue;
      }
    }
    if (/^@[\w.-]+$/i.test(part) || /^@[\p{L}\p{N}._-]+$/u.test(part)) {
      const member = matchMember(part, members);
      assigneeLabel = member ? memberPublicLabel(member) : part.replace(/^@/, "");
      assigneeMemberId = member ? String(member.id) : null;
      if (member) assignmentPatch = assignmentFieldsFromMembers([member]);
      tokens.push({
        kind: "person",
        value: assigneeLabel,
        memberId: assigneeMemberId || undefined,
        raw: part,
      });
      continue;
    }
    if (/^![\w.-]+$/i.test(part)) {
      const key = normalizeToken(part.slice(1));
      const mapped = PRIORITY_MAP[key];
      if (mapped) {
        priority = mapped.value;
        tokens.push({
          kind: "priority",
          value: mapped.value,
          label: mapped.label,
          raw: part,
        });
        continue;
      }
    }
    const asDate = parseNaturalDate(part, now);
    if (asDate && !/^\d+$/.test(part)) {
      // Avoid treating short numbers as dates; require natural word or month-like
      const looksDate =
        /hoy|today|manana|tomorrow|lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|sep|oct|nov|dec|\d{1,2}[\/-]/i.test(
          part,
        ) || Boolean(parseNaturalDate(part, now) && /[a-zA-Záéíóúñ]/i.test(part));
      if (looksDate || /^\d{4}-\d{2}-\d{2}$/.test(part)) {
        dueDate = asDate;
        tokens.push({
          kind: "date",
          value: asDate,
          label: part,
          raw: part,
        });
        continue;
      }
    }
    // Multi-word natural dates: "en 3 días" handled by joining look-ahead
    titleParts.push(part);
  }

  // Second pass for "en 3 días" / "in 3 days" left in titleParts
  const rejoined: string[] = [];
  for (let i = 0; i < titleParts.length; i += 1) {
    const a = titleParts[i];
    const b = titleParts[i + 1];
    const c = titleParts[i + 2];
    if (b && c && /^(en|in)$/i.test(a) && /^\d+$/.test(b) && /^(d[ií]as?|days?)$/i.test(c)) {
      const iso = parseNaturalDate(`${a} ${b} ${c}`, now);
      if (iso) {
        dueDate = iso;
        tokens.push({ kind: "date", value: iso, label: `${a} ${b} ${c}`, raw: `${a} ${b} ${c}` });
        i += 2;
        continue;
      }
    }
    rejoined.push(a);
  }

  return {
    cleanTitle: rejoined.join(" ").trim(),
    tokens,
    workItemType,
    priority,
    dueDate,
    assigneeMemberId,
    assigneeLabel,
    assignmentPatch,
  };
}

export function removeTokenFromTitle(title: string, raw: string) {
  return String(title || "")
    .split(/\s+/)
    .filter((part) => part !== raw)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
