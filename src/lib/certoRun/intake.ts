import type { Decision, Lane } from "./vocab";
import { DECISION_LABEL, LANE_LABEL } from "./vocab";

export const GATE_QUESTIONS = [
  { key: "commitment", question: "Is it a commitment?", hint: "Someone expects something to happen. If it's only a fact or context, it isn't a task.", no: { name: "Note", detail: "Goes to the client's notebook. No task is created." } },
  { key: "yours", question: "Is it yours?", hint: "You or your team must deliver it. If someone owes it to you, it's follow-up.", no: { name: "Follow-up", detail: "Lucy chases the person. It leaves your list." } },
  { key: "new", question: "Is it new?", hint: "The same commitment with the same client doesn't already exist.", no: { name: "Update the existing one", detail: "Lucy adds the new evidence to the item that already exists." } },
  { key: "alive", question: "Is it still alive?", hint: "The event or the date hasn't passed yet.", no: { name: "Not created", detail: "If it left a consequence, the consequence is created, not the event." } },
  { key: "promised", question: "Did you promise something concrete?", hint: "To someone external, or with a date.", no: { name: "Not your task", detail: "Stays as a note or isn't recorded." } },
] as const;

export type GateKey = (typeof GATE_QUESTIONS)[number]["key"];

export interface GateDestination {
  name: string;
  detail: string;
  pbi: boolean;
}

const TITLE_BANNED = /\d{1,2}\/\d{1,2}|⭐|^(rsvp|allied|boldr|waiting|delegate)\b|whatsapp|granola|outlook/i;

export function gateDest(answers: Partial<Record<GateKey, boolean>>): GateDestination | null {
  for (const question of GATE_QUESTIONS) {
    const answer = answers[question.key];
    if (answer === undefined) return null;
    if (answer === false) return { name: question.no.name, detail: question.no.detail, pbi: false };
  }
  return { name: "Create the PBI", detail: "With a lane, one decision, and the five fields.", pbi: true };
}

export function wordCount(title: string): number {
  return title.trim().split(/\s+/).filter(Boolean).length;
}

export interface TitleCheck {
  words: number;
  tooLong: boolean;
  banned: boolean;
  ok: boolean;
}

export function checkTitle(title: string): TitleCheck {
  const words = wordCount(title);
  const banned = TITLE_BANNED.test(title.trim());
  const tooLong = words > 12;
  return { words, tooLong, banned, ok: words > 0 && words <= 12 && !banned };
}

export function adminNeverMake(lane: Lane, decision: Decision): boolean {
  return lane === "admin" && decision === "make";
}

export interface PbiDraft {
  world: string;
  client: string;
  lane: Lane;
  decision: Decision;
  title: string;
  deliverable: string;
  doneWhen: string;
  nextStep: string;
  date: string;
  source: string;
  opsName?: string;
}

export function pbiReady(draft: PbiDraft): boolean {
  return checkTitle(draft.title).ok && !adminNeverMake(draft.lane, draft.decision) && Boolean(draft.deliverable.trim()) && Boolean(draft.doneWhen.trim());
}

export function pbiText(draft: PbiDraft): string {
  const ops = draft.opsName ?? "Lucy";
  const lane = LANE_LABEL[draft.lane] ?? draft.lane;
  const decision = DECISION_LABEL[draft.decision] ?? draft.decision;
  return [
    `${ops}, create this PBI in ${draft.world || "[world]"}:`,
    `Title: ${draft.title || "[verb + object + for whom]"}`,
    `Client Entity: ${draft.client || "[client]"} · Lane: ${lane} · Decision: ${decision}${draft.date ? ` · Date: ${draft.date}` : ""}`,
    "Description:",
    `Context: ${draft.title ? `captured in ${draft.source || "a meeting"}` : "[why it exists]"}.`,
    `Deliverable: ${draft.deliverable || "[what]"}.`,
    `Done when: ${draft.doneWhen || "[criterion]"}.`,
    `Next step: ${draft.nextStep || "[physical action]"}.`,
    `Source: ${draft.source || "[channel and date]"}.`,
    `Hang it from the Epic for ${draft.client || "this client"} and apply the intake gate.`,
  ].join("\n");
}

export function shortIntakeText(draft: PbiDraft, destination: string): string {
  const ops = draft.opsName ?? "Lucy";
  return `${ops}, log this in ${draft.world || "[world]"} as ${destination.toLowerCase()}: ${draft.title}${draft.client ? ` (${draft.client})` : ""}. Don't create a PBI.`;
}
