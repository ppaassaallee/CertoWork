export type CertoTextSize = "1" | "2" | "3" | "4" | "5";

export const CERTO_TEXT_SIZE_STORAGE_KEY = "certoWorkTextSize";
export const CERTO_TEXT_SIZE_EVENT = "certo-work:text-size";

export const CERTO_TEXT_SIZE_OPTIONS: Array<{
  value: CertoTextSize;
  label: string;
  description: string;
}> = [
  { value: "1", label: "Compact", description: "More information" },
  { value: "2", label: "Default", description: "Balanced" },
  { value: "3", label: "Comfortable", description: "Easier reading" },
  { value: "4", label: "Large", description: "High readability" },
  { value: "5", label: "Extra large", description: "Maximum readability" },
];

export function normalizeCertoTextSize(value: unknown): CertoTextSize {
  return value === "1" || value === "2" || value === "3" || value === "4" || value === "5" ? value : "2";
}

export function getStoredCertoTextSize(): CertoTextSize {
  if (typeof window === "undefined") return "2";
  return normalizeCertoTextSize(window.localStorage.getItem(CERTO_TEXT_SIZE_STORAGE_KEY));
}

export function applyCertoTextSize(size: CertoTextSize) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.certoTextSize = normalizeCertoTextSize(size);
}

export function setStoredCertoTextSize(size: CertoTextSize) {
  const normalized = normalizeCertoTextSize(size);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CERTO_TEXT_SIZE_STORAGE_KEY, normalized);
    window.dispatchEvent(new CustomEvent(CERTO_TEXT_SIZE_EVENT, { detail: normalized }));
  }
  applyCertoTextSize(normalized);
}
