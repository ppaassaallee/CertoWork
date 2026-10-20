export type Locale = "en" | "es";

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem("certo-locale");
    if (saved === "en" || saved === "es") return saved;
  } catch { /* storage may be unavailable */ }
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

let currentLocale: Locale = detectLocale();
if (typeof document !== "undefined") document.documentElement.lang = currentLocale;
const localeListeners = new Set<() => void>();

export function setLocale(locale: Locale) {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  if (currentLocale === locale) return;
  currentLocale = locale;
  try { window.localStorage.setItem("certo-locale", locale); } catch { /* storage may be unavailable */ }
  localeListeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void) {
  localeListeners.add(listener);
  return () => { localeListeners.delete(listener); };
}

export function getLocale() {
  return currentLocale;
}
