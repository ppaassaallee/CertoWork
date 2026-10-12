import type { KeyValueStore } from "./commandSearch";

export const DEV_TOOLS_STORAGE_KEY = "certo-dev-tools";

export function isDeveloperToolsEnabled(store?: KeyValueStore | null) {
  try {
    const target = store || (typeof localStorage === "undefined" ? null : localStorage);
    return target?.getItem(DEV_TOOLS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
