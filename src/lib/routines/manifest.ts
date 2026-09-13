/**
 * Declarative ritual manifests — interpreted by RitualRunner.
 * Future rituals (sprint retro, risk review) are new manifests, not new UI.
 */

import type { RoutineClass, RoutinePermissions } from "./types";

export type RitualCardType =
  | "ItemTriage"
  | "Finding"
  | "MetricStrip"
  | "Reflection"
  | "GoalComposer"
  | "TimeBlocks"
  | "Capacity"
  | "Summary";

export type CardSpec = {
  type: RitualCardType;
  id: string;
  props?: Record<string, unknown>;
};

export type StepSpec = {
  id: string;
  label: string;
  question: string;
  hint?: string;
  cards: CardSpec[];
  skippable: boolean;
  savesAs?: { blockType: string };
  /** When true, step is omitted in the "versión resumida". */
  skipInSummary?: boolean;
};

export type PrepareSpec = {
  /** Deterministic data keys the prepare step fills. */
  gather: Array<
    | "planned_items"
    | "done_items"
    | "undone_items"
    | "blocked_items"
    | "win_signals"
    | "prior_goals"
    | "protected_blocks"
    | "week_deadlines"
    | "epic_candidates"
    | "calendar_load"
    | "last_alignment"
  >;
};

export type ActionSpec = {
  type: "move_due" | "archive" | "create_item" | "link_week" | "store_blocks" | "remember_fact";
  fromStep?: string;
};

export type RecipeManifest = {
  id: string;
  name: string;
  tagline: string;
  domain: "personal" | "project" | "portfolio";
  class: RoutineClass;
  cadence: { default: string; cron: string; humanText: string };
  estimatedMinutes: number;
  /** ISO weekday expiry for unfinished sessions (WRAP → Monday). */
  expiresWeekday?: number;
  /** Offer condensed step ids when missed. */
  summaryStepIds?: string[];
  prepare: PrepareSpec;
  steps: StepSpec[];
  output: {
    note: { notebook: string; titleTemplate: string; blocks: string[] };
    actions: ActionSpec[];
  };
  chainsTo?: string;
  activationSentence: string;
  permissions?: Partial<RoutinePermissions>;
};

export function weekOfIso(date = new Date()): string {
  // ISO week: Thursday-based year week
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekLabel(weekOf: string, locale: "es" | "en" = "es"): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekOf);
  if (!match) return weekOf;
  const week = Number(match[2]);
  return locale === "es" ? `Semana ${week}` : `Week ${week}`;
}
