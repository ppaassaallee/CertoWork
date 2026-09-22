import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";

const LS_BRIEF = "certoDailyBrief";
const LS_BILLING = "certoBilling";
const LS_TABLES = "certoTables";
const LS_COLLAB = "certoCollab";
const EVT = "certo-feature-flag-changed";

function readLs(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeLs(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVT));
}

function useFlag(
  flag: "dailyBrief" | "billing" | "tables" | "collab",
  lsKey: string,
): boolean {
  const { user } = useAuth();
  const [remote, setRemote] = useState(false);
  const [local, setLocal] = useState(() => readLs(lsKey));

  useEffect(() => {
    if (!user?.uid) {
      setRemote(false);
      return;
    }
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      const flags = snap.exists()
        ? (snap.data() as { flags?: Record<string, unknown> }).flags
        : undefined;
      setRemote(flags?.[flag] === true);
    });
  }, [user?.uid, flag]);

  useEffect(() => {
    const sync = () => setLocal(readLs(lsKey));
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [lsKey]);

  return remote || local;
}

export function useDailyBriefEnabled() {
  return useFlag("dailyBrief", LS_BRIEF);
}

export function useBillingEnabled() {
  return useFlag("billing", LS_BILLING);
}

export function useTablesEnabled() {
  return useFlag("tables", LS_TABLES);
}

export function useCollabEnabled() {
  return useFlag("collab", LS_COLLAB);
}

export async function enableDailyBrief(uid: string) {
  writeLs(LS_BRIEF, true);
  try {
    await setDoc(doc(db, "users", uid), { flags: { dailyBrief: true } }, { merge: true });
  } catch {
    /* local ok */
  }
}

export async function enableBilling(uid: string) {
  writeLs(LS_BILLING, true);
  try {
    await setDoc(doc(db, "users", uid), { flags: { billing: true } }, { merge: true });
  } catch {
    /* local ok */
  }
}

export async function enableTables(uid: string) {
  writeLs(LS_TABLES, true);
  try {
    await setDoc(doc(db, "users", uid), { flags: { tables: true } }, { merge: true });
  } catch {
    /* local ok */
  }
}

export async function enableCollab(uid: string) {
  writeLs(LS_COLLAB, true);
  try {
    await setDoc(doc(db, "users", uid), { flags: { collab: true } }, { merge: true });
  } catch {
    /* local ok */
  }
}
