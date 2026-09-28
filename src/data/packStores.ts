import { createDocStore, useDocSelector, useDocStore, type DocRow } from "./createDocStore";

export type MilestoneDoc = DocRow & {
  projectId?: string;
  title?: string;
  name?: string;
  status?: string;
  workspaceId?: string;
};

export type RiskDoc = DocRow & {
  projectId?: string;
  title?: string;
  workspaceId?: string;
};

export type InvoiceDoc = DocRow & {
  projectId?: string;
  workspaceId?: string;
  status?: string;
};

export type TableStoreDoc = DocRow & {
  name?: string;
  workspaceId?: string;
  projectId?: string;
  favorite?: boolean;
};

export type TableRecordStoreDoc = DocRow & {
  tableId?: string;
  workspaceId?: string;
};

export const milestonesStore = createDocStore<MilestoneDoc>();
export const risksStore = createDocStore<RiskDoc>();
export const invoicesStore = createDocStore<InvoiceDoc>();
export const tablesStore = createDocStore<TableStoreDoc>();
export const tableRecordsStore = createDocStore<TableRecordStoreDoc>();
export const costTemplatesStore = createDocStore<DocRow>();
export const categoriesStore = createDocStore<DocRow>();

export function useMilestones() {
  return useDocStore(milestonesStore);
}

export function useRisks() {
  return useDocStore(risksStore);
}

export function useInvoices() {
  return useDocStore(invoicesStore);
}

export function useTables() {
  return useDocStore(tablesStore);
}

export function useMilestonesByProject(projectId: string | null | undefined) {
  return useDocSelector(
    milestonesStore,
    (rows) => (projectId ? rows.filter((row) => row.projectId === projectId) : []),
    (a, b) => a === b || (a.length === b.length && a.every((row, i) => row === b[i])),
  );
}

export function useRisksByProject(projectId: string | null | undefined) {
  return useDocSelector(
    risksStore,
    (rows) => (projectId ? rows.filter((row) => row.projectId === projectId) : []),
    (a, b) => a === b || (a.length === b.length && a.every((row, i) => row === b[i])),
  );
}

export function clearPackStores() {
  milestonesStore.clear();
  risksStore.clear();
  invoicesStore.clear();
  tablesStore.clear();
  tableRecordsStore.clear();
  costTemplatesStore.clear();
  categoriesStore.clear();
}
