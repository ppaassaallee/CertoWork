import { httpsCallable, getFunctions } from "firebase/functions";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { createTable, createRecord } from "../services/tableService";
import { saveStructuredRoutine } from "../../routines/structuredExecutor";
import type { StructuredAction, StructuredRoutine, StructuredTrigger } from "../../routines/structured";
import type { SystemTemplate } from "./systemTemplates";
import type { TableDoc } from "../types";

export type ProvisionResult = {
  tableIds: Record<string, string>;
  automationIds: string[];
  dashboardId?: string;
};

type LooseTrigger = StructuredTrigger & { tableKey?: string; formKey?: string };
type LooseAction = StructuredAction & { tableKey?: string };
type LooseAuto = Partial<StructuredRoutine> & {
  sentence: string;
  trigger?: LooseTrigger;
  actions?: LooseAction[];
  tableKey?: string;
};

function remapId(keyOrId: string | undefined, tableIds: Record<string, string>): string {
  if (!keyOrId) return Object.values(tableIds)[0] || "";
  return tableIds[keyOrId] || keyOrId;
}

function remapTrigger(trigger: LooseTrigger, tableIds: Record<string, string>): StructuredTrigger {
  const rawTable =
    "tableId" in trigger && trigger.tableId
      ? String(trigger.tableId)
      : trigger.tableKey
        ? String(trigger.tableKey)
        : undefined;
  const tableId = remapId(rawTable, tableIds);
  if (trigger.type === "record.created") {
    return { type: "record.created", tableId, groupId: trigger.groupId };
  }
  if (trigger.type === "record.changed") {
    return {
      type: "record.changed",
      tableId,
      columnId: trigger.columnId,
      to: trigger.to,
      from: trigger.from,
    };
  }
  if (trigger.type === "record.moved") {
    return { type: "record.moved", tableId, toGroupId: trigger.toGroupId };
  }
  if (trigger.type === "date.reached") {
    return {
      type: "date.reached",
      tableId,
      columnId: trigger.columnId,
      offsetDays: trigger.offsetDays,
      at: trigger.at,
    };
  }
  if (trigger.type === "schedule") {
    return { type: "schedule", cron: trigger.cron, tz: trigger.tz };
  }
  if (trigger.type === "form.submitted") {
    return { type: "form.submitted", formId: trigger.formId || trigger.formKey || "intake" };
  }
  if (trigger.type === "button") {
    return { type: "button", tableId, columnId: trigger.columnId };
  }
  return trigger;
}

function remapAction(action: LooseAction, tableIds: Record<string, string>): StructuredAction {
  if (action.type === "createRecord") {
    return {
      ...action,
      tableId: remapId(action.tableId || action.tableKey, tableIds),
    };
  }
  if (action.type === "forEachRecord") {
    return {
      ...action,
      tableId: remapId(action.tableId || action.tableKey, tableIds),
      actions: (action.actions || []).map((a) => remapAction(a as LooseAction, tableIds)),
    };
  }
  return action;
}

function scopeTableId(auto: LooseAuto, tableIds: Record<string, string>): string {
  const fromScope = (auto.scope as { tableId?: string } | undefined)?.tableId;
  const trig = auto.trigger;
  const fromTrigger =
    trig && "tableId" in trig && trig.tableId
      ? String(trig.tableId)
      : trig?.tableKey
        ? String(trig.tableKey)
        : undefined;
  const fromKey = auto.tableKey;
  return remapId(fromScope || fromTrigger || fromKey, tableIds);
}

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
        name: t.name,
        icon: t.icon || "▦",
        color: "#2547C4",
        visibility: "workspace",
        createdBy: opts.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

  // Remap link columns targetTableId
  for (const link of template.links || []) {
    const fromId = tableIds[link.fromTable];
    const toId = tableIds[link.toTable];
    if (!fromId || !toId) continue;
    const { getDoc, updateDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "tables", fromId));
    if (!snap.exists()) continue;
    const data = snap.data() as TableDoc;
    const columns = (data.columns || []).map((c) =>
      c.id === link.column || c.name === link.column
        ? { ...c, type: "link" as const, config: { ...(c.config || {}), targetTableId: toId, twoWay: !!link.twoWay } }
        : c,
    );
    await updateDoc(doc(db, "tables", fromId), { columns, updatedAt: new Date().toISOString() });
  }

  const automationIds: string[] = [];
  for (const auto of (template.automations || []) as LooseAuto[]) {
    if (!auto.trigger || !auto.actions) continue;
    const tableId = scopeTableId(auto, tableIds);
    const structured: StructuredRoutine = {
      kind: "structured",
      scope: { type: "table", tableId },
      trigger: remapTrigger(auto.trigger, tableIds),
      conditions: auto.conditions || [],
      actions: auto.actions.map((a) => remapAction(a, tableIds)),
      sentence: auto.sentence,
      enabled: true,
      owner: opts.userId,
      severity: auto.severity || "minor",
    };
    const id = await saveStructuredRoutine({
      workspaceId: opts.workspaceId,
      ownerUserId: opts.userId,
      tableId,
      tableName: template.name,
      structured,
      activate: true,
    });
    automationIds.push(id);
  }

  let dashboardId: string | undefined;
  if (template.dashboard) {
    dashboardId = `dash_${opts.workspaceId}_${template.id}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 80);
    await setDoc(
      doc(db, "dashboards", dashboardId),
      {
        workspaceId: opts.workspaceId,
        name: template.dashboard.name || "Dashboard",
        templateId: template.id,
        tableIds,
        widgets: (template.dashboard.widgets || []).map((w, i) => ({
          id: `w${i}`,
          title: (w as { title?: string }).title || `Widget ${i + 1}`,
          kind: (w as { type?: string }).type === "list" ? "list" : (w as { type?: string }).type === "bar" ? "chart" : "number",
          source: "table",
          metric: (w as { metric?: string }).metric,
        })),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  return { tableIds, automationIds, dashboardId };
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
