import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  SAVED_VIEWS,
  type SavedView,
  type Surface,
  type ViewScope,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function lastViewsKey(userId: string) {
  return `certo.views.last.${userId}`;
}

export async function listViews(
  workspaceId: string,
  surface: Surface,
  userId: string,
): Promise<SavedView[]> {
  const snap = await getDocs(
    query(
      collection(db, SAVED_VIEWS),
      where("workspaceId", "==", workspaceId),
      where("surface", "==", surface),
    ),
  );
  return snap.docs
    .map((row) => ({ id: row.id, ...(row.data() as Omit<SavedView, "id">) }))
    .filter(
      (view) =>
        view.scope === "team" ||
        view.ownerId === userId ||
        String((view as { userId?: string }).userId || "") === userId,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createView(
  input: Omit<SavedView, "id" | "createdAt" | "updatedAt" | "isDefault"> & {
    id?: string;
  },
): Promise<SavedView> {
  const now = nowIso();
  const payload: Omit<SavedView, "id"> = {
    workspaceId: input.workspaceId,
    surface: input.surface,
    name: input.name,
    icon: input.icon,
    scope: input.scope,
    ownerId: input.ownerId,
    layout: input.layout,
    columns: input.columns,
    quickActions: input.quickActions.slice(0, 4),
    filters: input.filters,
    sort: input.sort,
    groupBy: input.groupBy,
    density: input.density,
    showSubtasks: input.showSubtasks,
    createdAt: now,
    updatedAt: now,
  };
  if (input.id) {
    await setDoc(doc(db, SAVED_VIEWS, input.id), payload, { merge: true });
    return { id: input.id, ...payload };
  }
  const ref = await addDoc(collection(db, SAVED_VIEWS), payload);
  return { id: ref.id, ...payload };
}

export async function updateView(
  viewId: string,
  patch: Partial<SavedView>,
  actor: { userId: string; isAdmin?: boolean },
  existing: SavedView,
): Promise<SavedView> {
  const canEdit =
    existing.ownerId === actor.userId ||
    (existing.scope === "team" && Boolean(actor.isAdmin));
  if (!canEdit) {
    throw new Error("Only the owner or a workspace admin can edit this view.");
  }
  const next: SavedView = {
    ...existing,
    ...patch,
    id: viewId,
    quickActions: (patch.quickActions || existing.quickActions).slice(0, 4),
    updatedAt: nowIso(),
  };
  const { id: _id, isDefault: _default, ...data } = next;
  await updateDoc(doc(db, SAVED_VIEWS, viewId), data);
  return next;
}

export async function deleteView(viewId: string): Promise<void> {
  await deleteDoc(doc(db, SAVED_VIEWS, viewId));
}

/**
 * Copy-on-write: persist a default (virtual) view as a personal "Mi vista"
 * the first time the user customizes it.
 */
export async function persistDefaultCopy(
  defaultView: SavedView,
  userId: string,
  name = "Mi vista",
): Promise<SavedView> {
  const { id: _id, isDefault: _d, createdAt: _c, updatedAt: _u, ...rest } =
    defaultView;
  return createView({
    ...rest,
    name,
    scope: "personal" as ViewScope,
    ownerId: userId,
  });
}

export function getLastUsedViewId(userId: string, surface: Surface): string | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(lastViewsKey(userId));
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[surface] || null;
  } catch {
    return null;
  }
}

export async function setLastUsedView(
  userId: string,
  surface: Surface,
  viewId: string,
): Promise<void> {
  if (!userId) return;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(lastViewsKey(userId));
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      map[surface] = viewId;
      window.localStorage.setItem(lastViewsKey(userId), JSON.stringify(map));
    } catch {
      /* ignore quota */
    }
  }
  try {
    await setDoc(
      doc(db, "users", userId),
      { lastViews: { [surface]: viewId } },
      { merge: true },
    );
  } catch {
    /* users rules may reject until lastViews is allowed; LS still works */
  }
}
