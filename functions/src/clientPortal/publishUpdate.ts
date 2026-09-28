import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { parseStrict, updateViewZ } from "./schemas";
import { portalDoc, PROJECT_UPDATES, CLIENT_APPROVALS } from "./paths";
import { writeActivity } from "./writeActivity";
import { projectApprovals } from "./projectApprovals";
import { projectProject } from "./projectProject";

function str(v: unknown, fb = "") {
  return v == null ? fb : String(v);
}

/** Publish a ProjectUpdate → UpdateView + activity + approvals for needsClient. */
export async function publishUpdate(db: Firestore, updateId: string, publishedBy: string) {
  const ref = db.doc(`${PROJECT_UPDATES}/${updateId}`);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, reason: "missing" };
  const u = { id: snap.id, ...snap.data() } as Record<string, unknown>;
  const clientId = str(u.clientId);
  const projectId = str(u.projectId);
  if (!clientId || !projectId) return { ok: false as const, reason: "ids" };

  const now = new Date().toISOString();
  const needs = Array.isArray(u.needsClient) ? (u.needsClient as Array<Record<string, unknown>>) : [];
  const approvalIds: string[] = [];

  for (let i = 0; i < needs.length; i += 1) {
    const row = needs[i] || {};
    const approvalId = str(row.approvalId) || `${updateId}_need_${i}`;
    approvalIds.push(approvalId);
    await db.doc(`${CLIENT_APPROVALS}/${approvalId}`).set(
      {
        id: approvalId,
        workspaceId: str(u.workspaceId),
        projectId,
        clientId,
        kind: row.kind || "question",
        title: str(row.text || row.title, "Needs your decision"),
        description: row.description ? str(row.description) : undefined,
        refs: row.refs || {},
        requestedBy: publishedBy,
        requestedAt: now,
        status: "pending",
        reminders: [],
      },
      { merge: true },
    );
    needs[i] = { ...row, approvalId, text: str(row.text || row.title) };
  }

  await ref.set(
    {
      status: "published",
      publishedAt: now,
      publishedBy,
      needsClient: needs,
      updatedAt: now,
    },
    { merge: true },
  );

  const authorName = str(u.authorName, "Team");
  const period = (u.period && typeof u.period === "object" ? u.period : {}) as Record<string, unknown>;
  const view = parseStrict(updateViewZ, {
    id: updateId,
    projectId,
    period: { from: str(period.from), to: str(period.to) },
    title: str(u.title, "Update"),
    summary: str(u.summary),
    done: Array.isArray(u.done) ? u.done.map((x) => str(x)) : [],
    next: Array.isArray(u.next) ? u.next.map((x) => str(x)) : [],
    needsClient: needs.map((n) => ({
      text: str(n.text),
      approvalId: n.approvalId ? str(n.approvalId) : undefined,
    })),
    author: { name: authorName, title: u.authorTitle ? str(u.authorTitle) : undefined },
    publishedAt: now,
  });

  await db.doc(portalDoc(clientId, "updates", updateId)).set(view, { merge: true });
  await writeActivity(db, {
    clientId,
    id: `update_${updateId}`,
    kind: "update",
    title: view.title,
    body: view.summary.slice(0, 280),
    projectId,
    actor: view.author,
  });
  await projectApprovals(db, clientId);
  await projectProject(db, projectId);

  return { ok: true as const, clientId, updateId, approvalIds };
}

export { FieldValue };
