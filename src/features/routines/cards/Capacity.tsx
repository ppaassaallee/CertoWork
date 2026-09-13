import type { RitualCardProps } from "./types";
import type { GoalComposerAnswer } from "./GoalComposer";
import type { TimeBlocksAnswer } from "./TimeBlocks";

function hoursFromBlocks(blocks: TimeBlocksAnswer | null): number {
  if (!blocks?.blocks?.length) return 0;
  let total = 0;
  for (const block of blocks.blocks) {
    if (blocks.dayOff && block.day === blocks.dayOff) continue;
    const [sh, sm] = block.start.split(":").map(Number);
    const [eh, em] = block.end.split(":").map(Number);
    total += Math.max(0, eh + em / 60 - (sh + sm / 60));
  }
  return Math.round(total * 10) / 10;
}

export function CapacityCard({
  value,
  prepared,
  props,
  locale = "es",
}: RitualCardProps) {
  // value unused — capacity is derived from sibling answers via props.goals/blocks
  void value;
  const goals = (props?.goals as GoalComposerAnswer | undefined) || null;
  const blocks = (props?.blocks as TimeBlocksAnswer | undefined) || null;
  const available = hoursFromBlocks(blocks) || 20;
  const actionCount =
    goals?.goals?.reduce((n, g) => n + g.actions.filter((a) => a.title.trim()).length, 0) ||
    Number((prepared.metrics as any)?.planned || 0);
  const et = actionCount * 1.5;
  const over = et > available;

  return (
    <div className={`cw-ritual-capacity ${over ? "is-over" : ""}`} data-testid="card-capacity">
      <div>
        <b>{available}h</b>
        <span>{locale === "es" ? "disponibles" : "available"}</span>
      </div>
      <div>
        <b>{et}h</b>
        <span>{locale === "es" ? "ET estimado" : "estimated ET"}</span>
      </div>
      <div>
        <b>{Math.round((et / Math.max(available, 0.1)) * 100)}%</b>
        <span>{locale === "es" ? "carga" : "load"}</span>
      </div>
      {over ? (
        <p>
          {locale === "es"
            ? "Pasás el 100%. Sacá la acción de menor prioridad."
            : "Over 100%. Drop the lowest-priority action."}
        </p>
      ) : (
        <p>{locale === "es" ? "Entra." : "It fits."}</p>
      )}
    </div>
  );
}
