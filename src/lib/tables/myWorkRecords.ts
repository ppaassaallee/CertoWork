import { isTodayTask } from "../appleWidget";
import type { MyWorkActor } from "../myWorkItems";
import { actorEquivalentMemberIds, isThisWeekTask } from "../myWorkItems";
import { dateKey, isClosed, localDateKey } from "../workspaceDisplay";
import type { RecordDoc, TableDoc } from "./types";

export type MyWorkRecordItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  targetDate: string | null;
  owner: string | null;
  assigneeId: string | null;
  assigneeIds: string[];
  entityKind: "record";
  tableId: string;
  tableName: string;
  tableIcon: string;
  workItemType: "record";
  projectId: string | null;
  projectTitle: string;
};

function ownerTokens(actor: MyWorkActor, memberIds: string[] = []) {
  return new Set(
    [actor.userId, actor.memberId, ...memberIds]
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
}

export function recordOwnedByActor(
  record: RecordDoc,
  table: TableDoc,
  actor: MyWorkActor,
  memberIds: string[] = [],
) {
  const ownerCol = table.keyColumns.owner;
  if (!ownerCol || !actor.userId) return false;
  const owner = String(record.values[ownerCol] ?? "").trim();
  if (!owner) return false;
  return ownerTokens(actor, memberIds).has(owner);
}

export function recordToMyWorkItem(
  record: RecordDoc,
  table: TableDoc,
): MyWorkRecordItem {
  const titleCol = table.keyColumns.title;
  const statusCol = table.keyColumns.status;
  const ownerCol = table.keyColumns.owner;
  const dateCol = table.keyColumns.date;
  const statusRaw = statusCol ? String(record.values[statusCol] ?? "") : "";
  const statusOpt = table.columns
    .find((column) => column.id === statusCol)
    ?.options?.find((opt) => opt.id === statusRaw);
  const due = dateCol ? dateKey(record.values[dateCol]) : null;
  const owner = ownerCol ? String(record.values[ownerCol] ?? "") || null : null;
  return {
    id: record.id,
    title: String(record.values[titleCol] ?? "").trim() || table.name,
    status: statusOpt?.label || statusRaw || "open",
    dueDate: due,
    targetDate: due,
    owner,
    assigneeId: owner,
    assigneeIds: owner ? [owner] : [],
    entityKind: "record",
    tableId: table.id,
    tableName: table.name,
    tableIcon: table.icon || "▦",
    workItemType: "record",
    projectId: table.projectId ? String(table.projectId) : null,
    projectTitle: table.name,
  };
}

export function buildMyWorkRecords(input: {
  tables: TableDoc[];
  records: RecordDoc[];
  actor: MyWorkActor;
  memberIds?: string[];
  section?: "today" | "this_week" | "assigned" | "all";
  now?: Date;
}): MyWorkRecordItem[] {
  const tableById = new Map(input.tables.map((table) => [table.id, table] as const));
  const memberIds =
    input.memberIds || actorEquivalentMemberIds(input.actor);
  const now = input.now || new Date();
  const today = localDateKey(now);
  const out: MyWorkRecordItem[] = [];

  for (const record of input.records) {
    const table = tableById.get(record.tableId);
    if (!table) continue;
    if (!recordOwnedByActor(record, table, input.actor, memberIds)) continue;
    const item = recordToMyWorkItem(record, table);
    if (isClosed(item.status)) continue;
    const section = input.section || "assigned";
    if (section === "today") {
      if (!isTodayTask(item, today)) continue;
    } else if (section === "this_week") {
      if (!isThisWeekTask(item, now)) continue;
    }
    out.push(item);
  }

  return out.sort((a, b) =>
    String(a.dueDate || "").localeCompare(String(b.dueDate || "")),
  );
}

export function recordSearchText(record: RecordDoc, table: TableDoc) {
  const title = String(record.values[table.keyColumns.title] ?? "");
  return `${title} ${table.name}`.trim();
}
