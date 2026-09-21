import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Provision a multi-table template (Step 15). Client may also provision locally;
 * this callable is the authoritative batch path.
 */
export const provisionTableTemplate = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  const data = (request.data || {}) as {
    workspaceId?: string;
    template?: {
      name: string;
      tables: Array<{
        key: string;
        name: string;
        icon?: string;
        columns: unknown[];
        groups?: unknown[];
        sampleRecords?: Array<Record<string, unknown>>;
        nounSingular?: string;
      }>;
      links?: unknown[];
      automations?: unknown[];
    };
    withSampleData?: boolean;
  };
  if (!data.workspaceId || !data.template) {
    throw new HttpsError("invalid-argument", "workspaceId and template required");
  }
  const db = getFirestore();
  const uid = request.auth.uid;
  const idMap: Record<string, string> = {};
  for (const t of data.template.tables || []) {
    const ref = db.collection("tables").doc();
    idMap[t.key] = ref.id;
    const titleColumnId = (t.columns as Array<{ id: string }>)?.[0]?.id || "title";
    await ref.set({
      workspaceId: data.workspaceId,
      name: t.name,
      icon: t.icon || "▦",
      color: "#2547C4",
      visibility: "workspace",
      columns: t.columns || [],
      groups: t.groups || [{ id: "g-default", name: "Main", color: "#2547C4", order: 0 }],
      keyColumns: { title: titleColumnId },
      titleColumnId,
      nounSingular: t.nounSingular || "record",
      recordCount: 0,
      templateId: data.template.name,
      permissions: { visibility: "workspace", editors: [uid], viewers: [] },
      status: "active",
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (data.withSampleData && t.sampleRecords?.length) {
      let n = 0;
      for (const row of t.sampleRecords) {
        await db.collection("table_records").add({
          tableId: ref.id,
          workspaceId: data.workspaceId,
          values: row,
          groupId: "g-default",
          title: String(Object.values(row)[0] || "Untitled"),
          order: Date.now() + n,
          createdBy: uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        });
        n += 1;
      }
      await ref.set({ recordCount: n }, { merge: true });
    }
  }
  return { tableIds: idMap };
});
