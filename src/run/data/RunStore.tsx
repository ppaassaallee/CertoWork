import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** Same action names as the AI Studio store. Views import these and nothing else. */
export const RUN_STORE_ACTIONS = [
  "setWorld",
  "setTab",
  "setQueueMode",
  "setOutcome",
  "moveToMake",
  "setPriority",
  "setTop3",
  "togglePin",
  "saveAllocation",
  "updateDailyMetrics",
  "saveManifesto",
  "createPbi",
  "addIntakeLog",
  "approveProposal",
  "rejectProposal",
  "recordClose",
  "setProjectHealth",
  "updateLifePerson",
  "updateLifeBook",
  "showToast",
  "dismissToast",
  "clearCapError",
] as const;

export type RunStoreAction = (typeof RUN_STORE_ACTIONS)[number];

type Toast = { id: number; text: string } | null;

/* Action parameter names match the AI Studio store and are part of the type. */
/* eslint-disable no-unused-vars */
export interface RunStoreValue {
  world: string;
  tab: string;
  queueMode: string;
  toast: Toast;
  capError: string | null;
  setWorld: (world: string) => void;
  setTab: (tab: string) => void;
  setQueueMode: (mode: string) => void;
  setOutcome: (itemId: string, outcome: string) => Promise<void>;
  moveToMake: (itemId: string) => Promise<void>;
  setPriority: (itemId: string, priority: string) => Promise<void>;
  setTop3: (itemId: string) => Promise<void>;
  togglePin: (itemId: string) => Promise<void>;
  saveAllocation: (rows: unknown[]) => Promise<void>;
  updateDailyMetrics: (patch: Record<string, unknown>) => Promise<void>;
  saveManifesto: (text: string) => Promise<void>;
  createPbi: (draft: Record<string, unknown>) => Promise<void>;
  addIntakeLog: (entry: Record<string, unknown>) => Promise<void>;
  approveProposal: (id: string) => Promise<void>;
  rejectProposal: (id: string) => Promise<void>;
  recordClose: (close: Record<string, unknown>) => Promise<void>;
  setProjectHealth: (projectId: string, health: string) => Promise<void>;
  updateLifePerson: (personId: string, patch: Record<string, unknown>) => Promise<void>;
  updateLifeBook: (bookId: string, patch: Record<string, unknown>) => Promise<void>;
  showToast: (text: string) => void;
  dismissToast: () => void;
  clearCapError: () => void;
}
/* eslint-enable no-unused-vars */

const Ctx = createContext<RunStoreValue | null>(null);

const pending = async (...args: unknown[]) => {
  void args;
  throw new Error("RunStore write is not backed by Firestore yet");
};

export function StoreProvider({ children }: { children: ReactNode; workspaceId?: string }) {
  const [world, setWorldState] = useState(() => {
    try {
      return localStorage.getItem("certo-run-world") || "Pure AI";
    } catch {
      return "Pure AI";
    }
  });
  const [tab, setTabState] = useState("today");
  const [queueMode, setQueueModeState] = useState("make");
  const [toast, setToast] = useState<Toast>(null);
  const [capError, setCapError] = useState<string | null>(null);

  const value = useMemo<RunStoreValue>(() => ({
    world,
    tab,
    queueMode,
    toast,
    capError,
    setWorld: (next) => {
      setWorldState(next);
      try {
        localStorage.setItem("certo-run-world", next);
      } catch {
        /* UI convenience: last world only. */
      }
    },
    setTab: setTabState,
    setQueueMode: setQueueModeState,
    setOutcome: (itemId, outcome) => pending(itemId, outcome),
    moveToMake: (itemId) => pending(itemId),
    setPriority: (itemId, priority) => pending(itemId, priority),
    setTop3: (itemId) => pending(itemId),
    togglePin: (itemId) => pending(itemId),
    saveAllocation: (rows) => pending(rows),
    updateDailyMetrics: (patch) => pending(patch),
    saveManifesto: (text) => pending(text),
    createPbi: (draft) => pending(draft),
    addIntakeLog: (entry) => pending(entry),
    approveProposal: (id) => pending(id),
    rejectProposal: (id) => pending(id),
    recordClose: (close) => pending(close),
    setProjectHealth: (projectId, health) => pending(projectId, health),
    updateLifePerson: (personId, patch) => pending(personId, patch),
    updateLifeBook: (bookId, patch) => pending(bookId, patch),
    showToast: (text) => setToast({ id: Date.now(), text }),
    dismissToast: () => setToast(null),
    clearCapError: () => setCapError(null),
  }), [world, tab, queueMode, toast, capError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): RunStoreValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useStore requires StoreProvider");
  return value;
}
