import type { Firestore } from "firebase-admin/firestore";
import { activityViewZ, parseStrict } from "./schemas";
import { portalDoc } from "./paths";

export async function writeActivity(
  db: Firestore,
  input: {
    clientId: string;
    id: string;
    at?: string;
    kind: "update" | "request" | "document" | "invoice" | "approval" | "message";
    title: string;
    body?: string;
    projectId?: string;
    actor?: { name: string; avatar?: string };
  },
) {
  const view = parseStrict(activityViewZ, {
    id: input.id,
    at: input.at || new Date().toISOString(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    projectId: input.projectId,
    actor: input.actor,
  });
  await db.doc(portalDoc(input.clientId, "activity", input.id)).set(view, { merge: true });
  return view;
}
