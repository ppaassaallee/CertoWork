import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { db } from "../firebase";
import { civilDate, validEntry, type TimeEntry, type TimeSheet } from "../../features/time/model";

export const TIME_PAGE_SIZE = 100;
export type PageCursor = QueryDocumentSnapshot<DocumentData>;
const root = (workspaceId: string, userId: string) => `workspaces/${workspaceId}/time_users/${userId}`;
export type Timer = Omit<TimeEntry, "id" | "minutes"> & { startedAtMs: number };
export function timeStore(workspaceId: string, userId: string, database: Firestore = db) {
  const path = root(workspaceId, userId);
  const entries = collection(database, `${path}/entries`);
  const state = doc(database, `${path}/state/timer`);
  return {
    async loadWeek(first: string, last: string, cursor?: PageCursor) {
      const result = await getDocs(
        query(
          entries,
          where("date", ">=", first),
          where("date", "<=", last),
          orderBy("date"),
          orderBy(documentId()),
          ...(cursor ? [startAfter(cursor)] : []),
          limit(TIME_PAGE_SIZE),
        ),
      );
      return {
        rows: result.docs.map((row) => ({ ...row.data(), id: row.id }) as TimeEntry),
        cursor: result.docs[result.docs.length - 1],
        more: result.size === TIME_PAGE_SIZE,
      };
    },
    async sheets(): Promise<TimeSheet[]> {
      const result = await getDocs(query(collection(database, `${path}/sheets`), limit(100)));
      return result.docs.map((row) => ({
        id: row.id,
        name: String(row.data().name),
      }));
    },
    async addSheet(name: string) {
      const ref = doc(collection(database, `${path}/sheets`));
      await setDoc(ref, { name: name.trim(), createdAt: serverTimestamp() });
      return ref.id;
    },
    async save(row: TimeEntry) {
      if (!validEntry(row) || row.workspaceId !== workspaceId || row.userId !== userId)
        throw new Error("invalid_entry");
      const ref = row.id ? doc(entries, row.id) : doc(entries);
      const { id: _id, ...data } = row;
      void _id;
      await setDoc(ref, { ...data, updatedAt: serverTimestamp() });
    },
    async remove(id: string) {
      await deleteDoc(doc(entries, id));
    },
    async saveMany(rows: TimeEntry[]) {
      if (
        !rows.length ||
        rows.length > 50 ||
        rows.some((row) => !row.id || !validEntry(row) || row.workspaceId !== workspaceId || row.userId !== userId)
      )
        throw new Error("invalid_entry");
      // One target per paste keeps the rule-document access budget bounded.
      const first = rows[0];
      if (
        rows.some(
          (row) => row.projectId !== first.projectId || row.itemId !== first.itemId || row.sheetId !== first.sheetId,
        )
      )
        throw new Error("invalid_entry");
      const batch = writeBatch(database);
      rows.forEach(({ id, ...data }) => batch.set(doc(entries, id), { ...data, updatedAt: serverTimestamp() }));
      await batch.commit();
    },
    async timer(): Promise<Timer | null> {
      // A transaction read keeps timer state server-authoritative, including cross-tab starts.
      return runTransaction(database, async (tx) => {
        const value = await tx.get(state);
        return value.exists() ? (value.data() as Timer) : null;
      });
    },
    async start(value: Omit<TimeEntry, "id" | "minutes">): Promise<Timer> {
      const timer: Timer = {
        ...value,
        date: civilDate(),
        startedAtMs: Date.now(),
      };
      await runTransaction(database, async (tx) => {
        if ((await tx.get(state)).exists()) throw new Error("timer_running");
        tx.set(state, timer);
      });
      return timer;
    },
    async stop() {
      // Atomic stop: retries / two tabs cannot create duplicate entries.
      const ref = doc(entries);
      return runTransaction(database, async (tx) => {
        const value = await tx.get(state);
        if (!value.exists()) return null;
        const { startedAtMs, ...timer } = value.data() as Timer;
        const minutes = Math.max(1, Math.ceil((Date.now() - startedAtMs) / 60000));
        // Long timers require explicit recovery, never silently clamp or discard time.
        if (minutes > 1440) throw new Error("timer_long");
        tx.set(ref, { ...timer, minutes, updatedAt: serverTimestamp() });
        tx.delete(state);
        return { ...timer, minutes, id: ref.id } as TimeEntry;
      });
    },
    async discardTimer() {
      await deleteDoc(state);
    },
  };
}
