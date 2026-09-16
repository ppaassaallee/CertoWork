import type { DirectionControlRow } from "../buildDirectionData";
import {
  DirectionDot,
  DirectionEmpty,
  DirectionRow,
  DirectionWidget,
} from "./DirectionWidget";

export function ControlsWidget({
  title,
  linkLabel,
  emptyLabel,
  rows,
  formatMeta,
  onOpen,
  onOpenTable,
}: {
  title: string;
  linkLabel: string;
  emptyLabel: string;
  rows: DirectionControlRow[];
  formatMeta(row: DirectionControlRow): string;
  onOpen(): void;
  onOpenTable(tableId: string): void;
}) {
  return (
    <DirectionWidget linkLabel={linkLabel} onLink={onOpen} testId="direction-controls" title={title}>
      {rows.length === 0 ? (
        <DirectionEmpty label={emptyLabel} />
      ) : (
        rows.map((row) => (
          <DirectionRow
            key={row.tableId}
            leading={<DirectionDot color={row.color} />}
            meta={formatMeta(row)}
            metaTone={row.overdue > 0 ? "danger" : "neutral"}
            onClick={() => onOpenTable(row.tableId)}
            title={row.name}
          />
        ))
      )}
    </DirectionWidget>
  );
}
