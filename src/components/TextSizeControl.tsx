import { useEffect, useState } from "react";
import { useLocale } from "../lib/useLocale";
import {
  CERTO_TEXT_SIZE_EVENT,
  CERTO_TEXT_SIZE_OPTIONS,
  getStoredCertoTextSize,
  setStoredCertoTextSize,
  type CertoTextSize,
} from "../lib/textSize";

export function TextSizeControl({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const [textSize, setTextSize] = useState<CertoTextSize>(() => getStoredCertoTextSize());

  useEffect(() => {
    const sync = () => setTextSize(getStoredCertoTextSize());
    const customSync = (event: Event) => {
      const next = (event as CustomEvent<CertoTextSize>).detail;
      setTextSize(next || getStoredCertoTextSize());
    };
    window.addEventListener("storage", sync);
    window.addEventListener(CERTO_TEXT_SIZE_EVENT, customSync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CERTO_TEXT_SIZE_EVENT, customSync);
    };
  }, []);

  return (
    <div className={`do-text-size-control ${compact ? "is-compact" : ""}`} role="group" aria-label={locale === "es" ? "Tamaño del texto" : "Text size"}>
      {CERTO_TEXT_SIZE_OPTIONS.map((option, index) => {
        const spanish = [
          ["Compacto", "Más información"],
          ["Predeterminado", "Equilibrado"],
          ["Cómodo", "Lectura más fácil"],
          ["Grande", "Alta legibilidad"],
          ["Muy grande", "Máxima legibilidad"],
        ][index];
        const label = locale === "es" ? spanish[0] : option.label;
        const description = locale === "es" ? spanish[1] : option.description;
        return (
        <button
          aria-label={`${label}: ${description}`}
          aria-pressed={textSize === option.value}
          className={textSize === option.value ? "is-active" : ""}
          key={option.value}
          onClick={() => setStoredCertoTextSize(option.value)}
          title={label}
          type="button"
        >
          <span>{option.value}</span>
          {!compact && <small>{label}</small>}
        </button>
        );
      })}
    </div>
  );
}
