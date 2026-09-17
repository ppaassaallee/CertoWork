import type { RecordDoc, RecordValue, TableDoc } from "../../lib/tables";
import { RecordsViewSurface } from "../views/RecordsViewSurface";
import type { TableMember } from "./cells/RecordCells";

export type RecordsGridProps = {
  table: TableDoc;
  records: RecordDoc[];
  members: TableMember[];
  onFieldChange(recordId: string, columnId: string, value: RecordValue): void;
  onCreateRecord(title?: string): void;
  onDeleteRecords(ids: string[]): void;
  onOpenRecord(id: string): void;
  actorId?: string;
  /** @deprecated Prefer SavedView.groupBy via ViewsBar; ignored by ViewGrid alias. */
  groupByStatus?: boolean;
};

/**
 * Thin alias: Tables grid is now the views engine (`ViewGrid` + record adapter).
 */
export function RecordsGrid({
  table,
  records,
  members,
  onFieldChange,
  onCreateRecord,
  onDeleteRecords,
  onOpenRecord,
  actorId = "",
}: RecordsGridProps) {
  return (
    <RecordsViewSurface
      actorId={actorId}
      members={members}
      onCreateRecord={onCreateRecord}
      onDeleteRecords={onDeleteRecords}
      onFieldChange={onFieldChange}
      onOpenRecord={onOpenRecord}
      records={records}
      table={table}
      workspaceId={table.workspaceId}
    />
  );
}
