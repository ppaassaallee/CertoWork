import type { Firestore } from "firebase-admin/firestore";
import { parseStrict, threadViewZ } from "./schemas";
import { portalDoc } from "./paths";

function str(v: unknown, fb = "") {
  return v == null ? fb : String(v);
}

/** External conversations whose guests belong to the client. */
export async function projectThreads(db: Firestore, clientId: string) {
  const membersSnap = await db
    .collection("portal_members")
    .where("clientIds", "array-contains", clientId)
    .limit(100)
    .get();
  const emails = new Set(
    membersSnap.docs.map((d) => str(d.data().email).toLowerCase()).filter(Boolean),
  );
  if (!emails.size) return { ok: true as const, count: 0 };

  const guestsSnap = await db.collection("guests").limit(500).get().catch(() => null);
  const conversationIds = new Set<string>();
  for (const g of guestsSnap?.docs || []) {
    const data = g.data();
    if (!emails.has(str(data.email).toLowerCase())) continue;
    const ids = Array.isArray(data.conversationIds) ? data.conversationIds : [];
    ids.forEach((id: string) => conversationIds.add(String(id)));
  }

  const batch = db.batch();
  let count = 0;
  for (const conversationId of conversationIds) {
    const conv = await db.doc(`conversations/${conversationId}`).get();
    if (!conv.exists) continue;
    const c = conv.data() || {};
    if (c.type !== "external") continue;
    const view = parseStrict(threadViewZ, {
      id: conversationId,
      projectId: c.anchor?.id ? str(c.anchor.id) : undefined,
      subject: str(c.title, "Conversation"),
      lastMessageAt: c.lastMessageAt ? str(c.lastMessageAt) : undefined,
      unread: {},
    });
    batch.set(db.doc(portalDoc(clientId, "threads", conversationId)), view, { merge: true });
    count += 1;
  }
  await batch.commit();
  return { ok: true as const, count };
}
