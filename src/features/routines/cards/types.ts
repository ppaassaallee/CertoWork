import type { RitualCardType } from "../../lib/routines/manifest";

export type CardAnswer = unknown;

export type RitualCardProps = {
  cardId: string;
  type: RitualCardType;
  props?: Record<string, unknown>;
  prepared: Record<string, unknown>;
  value: CardAnswer;
  onChange: (value: CardAnswer) => void;
  locale?: "es" | "en";
};

export { ItemTriageCard } from "./ItemTriage";
export { FindingCard } from "./Finding";
export { MetricStripCard } from "./MetricStrip";
export { ReflectionCard } from "./Reflection";
export { GoalComposerCard } from "./GoalComposer";
export { TimeBlocksCard } from "./TimeBlocks";
export { CapacityCard } from "./Capacity";
export { SummaryCard } from "./Summary";
