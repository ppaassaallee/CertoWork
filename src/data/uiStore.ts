import { useCallback, useSyncExternalStore } from "react";

export type ProjectWizardIntent = "create" | "context";

type UiState = {
  projectWizardOpen: boolean;
  projectWizardIntent: ProjectWizardIntent;
  magicProjectOpen: boolean;
};

const listeners = new Set<() => void>();
let state: UiState = {
  projectWizardOpen: false,
  projectWizardIntent: "create",
  magicProjectOpen: false,
};

function emit() {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<UiState>) {
  state = { ...state, ...patch };
  emit();
}

export const uiStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot() {
    return state;
  },
  openProjectWizard(intent: ProjectWizardIntent = "create") {
    setState({ projectWizardOpen: true, projectWizardIntent: intent });
  },
  closeProjectWizard() {
    setState({ projectWizardOpen: false });
  },
  openMagicProject() {
    setState({ magicProjectOpen: true });
  },
  closeMagicProject() {
    setState({ magicProjectOpen: false });
  },
};

export function useUiStore() {
  return useSyncExternalStore(uiStore.subscribe, uiStore.getSnapshot, uiStore.getSnapshot);
}

export function useOpenProjectWizard() {
  return useCallback((intent: ProjectWizardIntent = "create") => {
    uiStore.openProjectWizard(intent);
  }, []);
}
