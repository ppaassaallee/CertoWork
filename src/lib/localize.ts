import type { Locale } from "./i18n";

/** Pick display copy for the user's language without changing stored values. */
export function localize<T>(locale: Locale, english: T, spanish: T): T {
  return { en: english, es: spanish }[locale];
}
