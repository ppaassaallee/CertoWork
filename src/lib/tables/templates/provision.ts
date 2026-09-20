import { httpsCallable, getFunctions } from "firebase/functions";
import { createTable, createRecord } from "../services/tableService";
import { saveStructuredRoutine } from "../../routines/structuredExecutor";
import type { SystemTemplate } from "./systemTemplates";
import type { TableDoc } from "../types";

export type ProvisionResult = {
  tableIds: Record<string, string>;
  automationIds: string[];
  dashboardId?: string;
};

/** Client-side provision (works without CF deploy); CF is authoritative batch path. */
export async function provisionTemplateLocal(
  template: SystemTemplate,
  opts: { workspaceId: string; userId: string; withSampleData?: boolean },
): Promise<ProvisionResult> {
  const tableIds: Record<string, string> = {};
  for (const t of template.tables) {
    const id = await createTable({
      workspaceId: opts.workspaceId,
      createdBy: opts.userId,
      name: t.name,
      columns: t.columns,
      groups: t.groups,
      titleColumnId: t.columns[0]?.id,
      icon: t.icon,
      nounSingular: t.nounSingular,
      templateId: template.id,
    });
    tableIds[t.key] = id;
    if (opts.withSampleData && t.sampleRecords?.length) {
      const tableStub = {
        id,
        workspaceId: opts.workspaceId,
        columns: t.columns,
        groups: t.groups,
        titleColumnId: t.columns[0]?.id,
        keyColumns: { title: t.columns[0]?.id || "title" },
        recordCount: 0,
      } as TableDoc;
      for (const row of t.sampleRecords) {
        await createRecord({
          table: tableStub,
          createdBy: opts.userId,
          values: row as never,
          groupId: t.groups?.[0]?.id,
        });
      }
    }
  }

  const automationIds: string[] = [];
  for (const auto of template.automations || []) {
    if (!auto.trigger || !auto.actions) continue;
    // Remap table keys in trigger/actions when possible
    const structured = {
      kind: "structured" as const,
      scope: { type: "table" as const, tableId: tableIds[(auto.scope as { tableId?: string })?.tableId || ""] || Object.values(tableIds)[0] },
      trigger: auto.trigger as never,
      conditions: auto.conditions || [],
      actions: auto.actions as never,
      sentence: auto.sentence,
      enabled: true,
      owner: opts.userId,
      severity: auto.severity || "minor",
    };
    // Patch tableIds inside trigger
    if (structured.trigger && typeof structured.trigger === "object" && "tableId" in structured.trigger) {
      const key = String((structured.trigger as { tableId: string }).tableId);
      (structured.trigger as { tableId: string }).tableId = tableIds[key] || key;
    }
    const id = await saveStructuredRoutine({
      workspaceId: opts.workspaceId,
      ownerUserId: opts.userId,
      tableId: structured.scope.tableId,
      tableName: template.name,
      structured,
      activate: true,
    });
    automationIds.push(id);
  }

  return { tableIds, automationIds };
}

export async function provisionTemplateRemote(
  template: SystemTemplate,
  opts: { workspaceId: string; withSampleData?: boolean },
) {
  try {
    const fn = httpsCallable(getFunctions(), "provisionTableTemplate");
    const res = await fn({
      workspaceId: opts.workspaceId,
      template,
      withSampleData: opts.withSampleData,
    });
    return res.data as { tableIds: Record<string, string> };
  } catch {
    return null;
  }
}
