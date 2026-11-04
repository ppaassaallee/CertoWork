import { fromMinutes, minutesOf, mondayOf, toIsoDate, weekday } from "./dates";

export interface DayTemplate {
  wake: { start: string; minutes: number };
  brief: { start: string; end: string };
  make: { start: string; end: string };
  admin: { start: string; end: string; days: number[] };
  meetingsEnd: string;
  family: { start: string; end: string };
  afternoon: { start: string; end: string };
  close: { start: string; end: string };
  evening: { start: string; end: string };
  sunday: { start: string; end: string; name: string; sub: string };
  saturday: { start: string; end: string; name: string; sub: string };
  morningWorld: { tueThu: string; other: string };
  sharedWorlds: [string, string];
}

export const DEFAULT_TEMPLATE: DayTemplate = {
  wake: { start: "05:45", minutes: 15 },
  brief: { start: "06:45", end: "07:00" },
  make: { start: "07:00", end: "09:00" },
  admin: { start: "09:00", end: "09:30", days: [2, 4] },
  meetingsEnd: "13:15",
  family: { start: "13:15", end: "14:45" },
  afternoon: { start: "14:45", end: "17:30" },
  close: { start: "17:30", end: "18:00" },
  evening: { start: "18:00", end: "22:00" },
  sunday: { start: "12:00", end: "21:00", name: "Family and rest", sub: "No work on Sundays" },
  saturday: { start: "08:00", end: "21:00", name: "Weekend", sub: "No delivery work" },
  morningWorld: { tueThu: "Boldr AI", other: "Pure AI" },
  sharedWorlds: ["Pure AI", "Boldr AI"],
};

export type BlockKind =
  | "wake"
  | "brief"
  | "make"
  | "admin"
  | "meetings"
  | "family"
  | "afternoon"
  | "weekly"
  | "close"
  | "evening"
  | "workout"
  | "weekend"
  | "before"
  | "after";

export interface DayBlock {
  start: string;
  end: string;
  kind: BlockKind;
  name: string;
  sub: string;
  world: string;
}

export interface WorkoutSession {
  dow: number;
  start: string;
  minutes: number;
  type: string;
}

export interface WeekAssignment {
  world?: string;
  epic?: string;
}

export function defaultMorningWorld(dow: number, template: DayTemplate = DEFAULT_TEMPLATE): string {
  return dow === 2 || dow === 4 ? template.morningWorld.tueThu : template.morningWorld.other;
}

export function morningWorld(
  iso: string,
  template: DayTemplate = DEFAULT_TEMPLATE,
  weekAssign: Record<string, WeekAssignment> = {},
): string {
  const date = iso;
  const di = (weekday(date) + 6) % 7;
  const assigned = weekAssign[`${di}-solo`]?.world;
  if (assigned) return assigned;
  return defaultMorningWorld(weekday(date), template);
}

export function dayPlanBase(
  iso: string,
  template: DayTemplate = DEFAULT_TEMPLATE,
  weekAssign: Record<string, WeekAssignment> = {},
): DayBlock[] {
  const dow = weekday(iso);
  if (dow === 0) {
    return [{ start: template.sunday.start, end: template.sunday.end, kind: "weekend", name: template.sunday.name, sub: template.sunday.sub, world: "Personal" }];
  }
  if (dow === 6) {
    return [{ start: template.saturday.start, end: template.saturday.end, kind: "weekend", name: template.saturday.name, sub: template.saturday.sub, world: "Personal" }];
  }
  const blocks: DayBlock[] = [
    { start: template.brief.start, end: template.brief.end, kind: "brief", name: "Brief and decisions", sub: "Read the brief, answer yes or no", world: "work" },
    { start: template.make.start, end: template.make.end, kind: "make", name: "Make: only me", sub: "No meetings", world: morningWorld(iso, template, weekAssign) },
  ];
  if (template.admin.days.includes(dow)) {
    blocks.push({ start: template.admin.start, end: template.admin.end, kind: "admin", name: "Admin batch", sub: "Approve, delegate or drop", world: "work" });
    blocks.push({ start: template.admin.end, end: template.meetingsEnd, kind: "meetings", name: "Meetings", sub: "25 or 50 min, with an agenda", world: "work" });
  } else {
    blocks.push({ start: template.make.end, end: template.meetingsEnd, kind: "meetings", name: "Meetings", sub: "25 or 50 min, with an agenda", world: "work" });
  }
  blocks.push({ start: template.family.start, end: template.family.end, kind: "family", name: "Family and lunch", sub: "Untouchable", world: "Personal" });
  blocks.push(
    dow === 5
      ? { start: template.afternoon.start, end: template.afternoon.end, kind: "weekly", name: "Weekly review", sub: "No clients: traffic lights and pruning", world: "work" }
      : { start: template.afternoon.start, end: template.afternoon.end, kind: "afternoon", name: "Fronts afternoon", sub: "Projects and follow-up", world: defaultMorningWorld(dow, template) },
  );
  blocks.push({ start: template.close.start, end: template.close.end, kind: "close", name: "Close the day", sub: "Lucy closes at 5:47 pm", world: "work" });
  blocks.push({ start: template.evening.start, end: template.evening.end, kind: "evening", name: "Evening", sub: "Hard stop at 10:00 pm", world: "Personal" });
  return blocks;
}

export function dayPlan(
  iso: string,
  template: DayTemplate = DEFAULT_TEMPLATE,
  weekAssign: Record<string, WeekAssignment> = {},
  workouts: WorkoutSession[] = [],
  wakeStart = template.wake.start,
): DayBlock[] {
  const blocks = dayPlanBase(iso, template, weekAssign);
  const dow = weekday(iso);
  const extra: DayBlock[] = workouts
    .filter((session) => session.dow === dow)
    .map((session) => ({
      start: session.start,
      end: fromMinutes(minutesOf(session.start) + session.minutes),
      kind: "workout" as const,
      name: session.type,
      sub: `${session.minutes} min · protected like a meeting`,
      world: "Personal",
    }));
  if (dow > 0 && dow < 6) {
    extra.push({
      start: wakeStart,
      end: fromMinutes(minutesOf(wakeStart) + template.wake.minutes),
      kind: "wake",
      name: "Get up and read the manifesto",
      sub: "Same time, seven days",
      world: "Personal",
    });
  }
  return blocks.concat(extra).sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}

export function vis(block: DayBlock, activeWorld: string): boolean {
  const world = block.world || "Personal";
  return world === activeWorld || (world === "work" && activeWorld !== "Personal");
}

export function muteLabel(block: DayBlock, activeWorld: string): string {
  if (activeWorld === "Personal") return "Work";
  if (block.world === "Personal") return "Personal time";
  return `Not ${activeWorld}`;
}

export function currentBlock(plan: DayBlock[], nowMinutes: number): DayBlock {
  for (const block of plan) {
    if (nowMinutes >= minutesOf(block.start) && nowMinutes < minutesOf(block.end)) return block;
  }
  const first = plan[0];
  const last = plan[plan.length - 1];
  if (first && nowMinutes < minutesOf(first.start)) {
    return { start: "00:00", end: first.start, kind: "before", name: "Before the brief", sub: "", world: "work" };
  }
  return { start: last?.end ?? "18:00", end: "23:59", kind: "after", name: "After hours", sub: "", world: "Personal" };
}

export function nowChip(plan: DayBlock[], activeWorld: string, nowMinutes: number): { inside: boolean; label: string; time: string } {
  const current = currentBlock(plan, nowMinutes);
  if (vis(current, activeWorld) && current.kind !== "before" && current.kind !== "after") {
    return { inside: true, label: current.name, time: `${current.start}–${current.end}` };
  }
  const next = plan.filter((block) => vis(block, activeWorld) && minutesOf(block.start) > nowMinutes)[0];
  if (next) return { inside: false, label: next.name, time: next.start };
  return { inside: false, label: "", time: "" };
}

export function isoFromDate(date: Date): string {
  return toIsoDate(date);
}

export { mondayOf };
