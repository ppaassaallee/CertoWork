/**
 * Table list queries that stay inside canReadTable.
 * A workspaceId-only list fails for everyone when any private table exists,
 * because Firestore rejects the snapshot if one matched document is denied.
 *
 * Legacy tables with no visibility field are returned only to their creator
 * (the createdBy query). Other members see them after visibility is set to
 * workspace, project, members, team, or shared. Rules still allow a direct get.
 */

export const SHARED_TABLE_VISIBILITIES = [
  "workspace",
  "project",
  "members",
  "team",
  "shared",
] as const;

export type ReadableFilter = {
  field: "workspaceId" | "createdBy" | "visibility" | "tableId";
  op: "==" | "in";
  value: string | readonly string[];
};

export function readableTableQueryPlans(workspaceId: string, uid: string): ReadableFilter[][] {
  const workspace = String(workspaceId || "").trim();
  const userId = String(uid || "").trim();
  if (!workspace || !userId) return [];
  return [
    [
      { field: "workspaceId", op: "==", value: workspace },
      { field: "createdBy", op: "==", value: userId },
    ],
    // One equality per visibility. A single denied value must not hide the rest,
    // which is what an `in` query does when any matched document fails the rule.
    ...SHARED_TABLE_VISIBILITIES.map((visibility) => [
      { field: "workspaceId" as const, op: "==" as const, value: workspace },
      { field: "visibility" as const, op: "==" as const, value: visibility },
    ]),
  ];
}

/** Records for tables the caller can already see. Empty when there are no tables. */
export function readableRecordQueryPlans(workspaceId: string, tableIds: string[]): ReadableFilter[][] {
  const workspace = String(workspaceId || "").trim();
  const ids = [...new Set(tableIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!workspace || ids.length === 0) return [];
  const plans: ReadableFilter[][] = [];
  for (let index = 0; index < ids.length; index += 10) {
    plans.push([
      { field: "workspaceId", op: "==", value: workspace },
      { field: "tableId", op: "in", value: ids.slice(index, index + 10) },
    ]);
  }
  return plans;
}

export function planIsWorkspaceWideOnly(plan: ReadableFilter[]) {
  return plan.length === 1 && plan[0]?.field === "workspaceId";
}
