import { useSyncExternalStore } from "react";
import { getLocale, subscribeLocale } from "./i18n";

/** Keep memoized surfaces in sync with the workspace language selector. */
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, () => "en" as const);
}
