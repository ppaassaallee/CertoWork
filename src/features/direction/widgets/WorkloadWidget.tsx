import type { DirectionWorkloadRow } from "../buildDirectionData";
import {
  DirectionAvatar,
  DirectionBar,
  DirectionEmpty,
  DirectionWidget,
} from "./DirectionWidget";

function toneForRatio(ratio: number): "danger" | "warning" | "ok" {
  if (ratio > 1.15) return "danger";
  if (ratio > 1) return "warning";
  return "ok";
}

export function WorkloadWidget({
  title,
  linkLabel,
  emptyLabel,
  rows,
  onOpen,
  onOpenPerson,
}: {
  title: string;
  linkLabel: string;
  emptyLabel: string;
  rows: DirectionWorkloadRow[];
  onOpen(): void;
  onOpenPerson(userId: string): void;
}) {
  return (
    <DirectionWidget linkLabel={linkLabel} onLink={onOpen} testId="direction-workload" title={title}>
      {rows.length === 0 ? (
        <DirectionEmpty label={emptyLabel} />
      ) : (
        rows.map((row) => {
          const tone = toneForRatio(row.ratio);
          return (
            <button
              className="cw-dir-row"
              key={row.userId}
              onClick={() => onOpenPerson(row.userId)}
              type="button"
            >
              <DirectionAvatar name={row.name} />
              <span className="cw-dir-row-title">{row.name}</span>
              <DirectionBar ratio={row.ratio} tone={tone} />
              <span className={`cw-dir-row-meta${tone === "ok" ? "" : ` is-${tone}`}`}>
                {Math.round(row.hoursOpen)} / {Math.round(row.hoursCapacity)} h
              </span>
            </button>
          );
        })
      )}
    </DirectionWidget>
  );
}
