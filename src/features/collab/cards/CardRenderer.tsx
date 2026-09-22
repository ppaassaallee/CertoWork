import type { MessageCard } from "../../../lib/collab/types";
import { ItemCard } from "./ItemCard";
import { ProjectCard } from "./ProjectCard";
import { RecordCard } from "./RecordCard";
import { InvoiceCard } from "./InvoiceCard";
import { ApprovalCard } from "./ApprovalCard";
import { SignalCardEmbed } from "./SignalCardEmbed";
import { BriefCard } from "./BriefCard";
import { ActionItemsCard, type ActionItemRow } from "./ActionItemsCard";

export type CardRendererProps = {
  card: MessageCard;
  onApprove?: () => void;
  onDecline?: () => void;
  onCreateItem?: (item: ActionItemRow, index: number) => void;
  onDismiss?: (item: ActionItemRow, index: number) => void;
};

/** Renders a message card by `card.type`. */
export function CardRenderer({
  card,
  onApprove,
  onDecline,
  onCreateItem,
  onDismiss,
}: CardRendererProps) {
  switch (card.type) {
    case "item":
      return <ItemCard card={card} />;
    case "project":
      return <ProjectCard card={card} />;
    case "record":
      return <RecordCard card={card} />;
    case "invoice":
      return <InvoiceCard card={card} />;
    case "approval":
      return <ApprovalCard card={card} onApprove={onApprove} onDecline={onDecline} />;
    case "signal":
      return <SignalCardEmbed card={card} />;
    case "brief":
      return <BriefCard card={card} />;
    case "action_items":
      return (
        <ActionItemsCard card={card} onCreateItem={onCreateItem} onDismiss={onDismiss} />
      );
    default:
      return null;
  }
}
