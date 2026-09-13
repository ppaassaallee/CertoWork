import { ItemTriageCard } from "./ItemTriage";
import { FindingCard } from "./Finding";
import { MetricStripCard } from "./MetricStrip";
import { ReflectionCard } from "./Reflection";
import { GoalComposerCard } from "./GoalComposer";
import { TimeBlocksCard } from "./TimeBlocks";
import { CapacityCard } from "./Capacity";
import { SummaryCard } from "./Summary";
import type { RitualCardProps } from "./types";
import type { RitualCardType } from "../../../lib/routines/manifest";

export type { RitualCardProps, CardAnswer } from "./types";
export {
  ItemTriageCard,
  FindingCard,
  MetricStripCard,
  ReflectionCard,
  GoalComposerCard,
  TimeBlocksCard,
  CapacityCard,
  SummaryCard,
};

export function RitualCardHost(props: RitualCardProps) {
  switch (props.type as RitualCardType) {
    case "ItemTriage":
      return <ItemTriageCard {...props} />;
    case "Finding":
      return <FindingCard {...props} />;
    case "MetricStrip":
      return <MetricStripCard {...props} />;
    case "Reflection":
      return <ReflectionCard {...props} />;
    case "GoalComposer":
      return <GoalComposerCard {...props} />;
    case "TimeBlocks":
      return <TimeBlocksCard {...props} />;
    case "Capacity":
      return <CapacityCard {...props} />;
    case "Summary":
      return <SummaryCard {...props} />;
    default:
      return null;
  }
}
