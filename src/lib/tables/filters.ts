import type { Column, RecordDoc, RecordValue, TableDoc } from "./types";

export type TableFilterState = {
  query: string;
  statusIds: string[];
  ownerIds: string[];
  dateFrom: string | null;
  dateTo: string | null;
  columnEquals: Record<string, string>;
};

export function emptyTableFilters(): TableFilterState {
  return {
    query: "",
    statusIds: [],
    ownerIds: [],
    dateFrom: null,
    dateTo: null,
    columnEquals: {},
  };
}

export function tableFiltersActive(filters: TableFilterState): boolean {
  return Boolean(
    filters.query.trim() ||
      filters.statusIds.length ||
      filters.ownerIds.length ||
      filters.dateFrom ||
      filters.dateTo ||
      Object.keys(filters.columnEquals).some((key) => filters.columnEquals[key]),
  );
}

function valueText(value: RecordValue): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(" ");
  return String(value);
}

export function filterTableRecords(
  table: Pick<TableDoc, "columns" | "keyColumns">,
  records: RecordDoc[],
  filters: TableFilterState,
): RecordDoc[] {
  const q = filters.query.trim().toLowerCase();
  const statusCol = table.keyColumns.status;
  const ownerCol = table.keyColumns.owner;
  const dateCol = table.keyColumns.date;

  return records.filter((record) => {
    if (statusCol && filters.statusIds.length) {
      const status = String(record.values[statusCol] ?? "");
      if (!filters.statusIds.includes(status)) return false;
    }
    if (ownerCol && filters.ownerIds.length) {
      const owner = String(record.values[ownerCol] ?? "");
      if (!filters.ownerIds.includes(owner)) return false;
    }
    if (dateCol && (filters.dateFrom || filters.dateTo)) {
      const raw = String(record.values[dateCol] ?? "").slice(0, 10);
      if (!raw) return false;
      if (filters.dateFrom && raw < filters.dateFrom) return false;
      if (filters.dateTo && raw > filters.dateTo) return false;
    }
    for (const [columnId, expected] of Object.entries(filters.columnEquals)) {
      if (!expected) continue;
      if (String(record.values[columnId] ?? "") !== expected) return false;
    }
    if (!q) return true;
    const hay = table.columns
      .map((column: Column) => valueText(record.values[column.id] ?? null))
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
