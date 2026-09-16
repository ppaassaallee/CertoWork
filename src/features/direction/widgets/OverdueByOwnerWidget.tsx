import type { DirectionOverdueOwner } from "../buildDirectionData";
import {
  DirectionAvatar,
  DirectionEmpty,
  DirectionRow,
  DirectionWidget,
} from "./DirectionWidget";

export function OverdueByOwnerWidget({
  title,
  linkLabel,
  emptyLabel,
  rows,
  totalLabel,
  onOpen,
  onOpenOwner,
}: {
  title: string;
  linkLabel: string;
  emptyLabel: string;
  rows: DirectionOverdueOwner[];
  totalLabel: string;
  onOpen(): void;
  onOpenOwner(userId: string | null): void;
}) {
  return (
    <DirectionWidget
      linkLabel={totalLabel || linkLabel}
      onLink={onOpen}
      testId="direction-overdue"
      title={title}
    >
      {rows.length === 0 ? (
        <DirectionEmpty label={emptyLabel} />
      ) : (
        rows.map((row) => {
          const meta =
            row.userId === null
              ? String(row.count)
              : `${row.count} · ${row.oldestDays} d`;
          return (
            <DirectionRow
              key={row.userId ?? "none"}
              leading={<DirectionAvatar name={row.name} />}
              meta={meta}
              metaTone={row.userId === null ? "danger" : "neutral"}
              onClick={() => onOpenOwner(row.userId)}
              title={row.name}
            />
          );
        })
      )}
    </DirectionWidget>
  );
}
