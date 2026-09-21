import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

/** Unified entity link endpoints used by Tables + Items + Notes + Billing. */
export type EntityRef = {
  type: "record" | "item" | "note" | "project" | "invoice" | "task" | "ticket";
  id: string;
  tableId?: string;
};

function linkId(a: EntityRef, b: EntityRef) {
  return `${a.type}_${a.id}__${b.type}_${b.id}`.replace(/[/]/g, "_").slice(0, 700);
}

/**
 * Two docs per link (one per direction) for cheap lookups from either side.
 * Falls back to a single forward doc when reverse write fails.
 */
export async function link(
  workspaceId: string,
  userId: string,
  a: EntityRef,
  b: EntityRef,
): Promise<void> {
  const forward = {
    workspaceId,
    userId,
    createdBy: userId,
    fromEntityType: a.type,
    fromEntityId: a.id,
    fromTableId: a.tableId || null,
    toEntityType: b.type,
    toEntityId: b.id,
    toTableId: b.tableId || null,
    relationType: "entity_link",
    createdAt: serverTimestamp(),
  };
  const reverse = {
    ...forward,
    fromEntityType: b.type,
    fromEntityId: b.id,
    fromTableId: b.tableId || null,
    toEntityType: a.type,
    toEntityId: a.id,
    toTableId: a.tableId || null,
  };
  const idA = linkId(a, b);
  const idB = linkId(b, a);
  const existing = await getDoc(doc(db, "entity_links", idA));
  if (existing.exists()) return;
  await setDoc(doc(db, "entity_links", idA), forward);
  try {
    await setDoc(doc(db, "entity_links", idB), reverse);
  } catch {
    /* reverse optional if rules deny */
  }
}

export async function unlink(a: EntityRef, b: EntityRef): Promise<void> {
  await deleteDoc(doc(db, "entity_links", linkId(a, b))).catch(() => undefined);
  await deleteDoc(doc(db, "entity_links", linkId(b, a))).catch(() => undefined);
}

export async function listLinks(entity: EntityRef): Promise<EntityRef[]> {
  const snap = await getDocs(
    query(
      collection(db, "entity_links"),
      where("fromEntityType", "==", entity.type),
      where("fromEntityId", "==", entity.id),
    ),
  );
  return snap.docs.map((row) => {
    const d = row.data() as {
      toEntityType: EntityRef["type"];
      toEntityId: string;
      toTableId?: string | null;
    };
    return {
      type: d.toEntityType,
      id: d.toEntityId,
      tableId: d.toTableId || undefined,
    };
  });
}

export async function listLinkedRecords(
  workspaceId: string,
  entity: EntityRef,
): Promise<Array<{ recordId: string; tableId: string; title?: string }>> {
  const links = await listLinks(entity);
  const out: Array<{ recordId: string; tableId: string; title?: string }> = [];
  for (const l of links.filter((x) => x.type === "record")) {
    const snap = await getDoc(doc(db, "table_records", l.id));
    if (!snap.exists()) continue;
    const data = snap.data() as { tableId: string; title?: string; workspaceId?: string };
    if (data.workspaceId && data.workspaceId !== workspaceId) continue;
    out.push({ recordId: snap.id, tableId: data.tableId, title: data.title });
  }
  return out;
}
