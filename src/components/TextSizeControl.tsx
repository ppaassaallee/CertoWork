import { useEffect, useState } from "react";
import {
  CERTO_TEXT_SIZE_EVENT,
  CERTO_TEXT_SIZE_OPTIONS,
  getStoredCertoTextSize,
  setStoredCertoTextSize,
  type CertoTextSize,
} from "../lib/textSize";

export function TextSizeControl({ compact = false }: { compact?: boolean }) {
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
    <div className={`do-text-size-control ${compact ? "is-compact" : ""}`} role="group" aria-label="Text size">
      {CERTO_TEXT_SIZE_OPTIONS.map((option) => (
        <button
          aria-label={`${option.label}: ${option.description}`}
          aria-pressed={textSize === option.value}
          className={textSize === option.value ? "is-active" : ""}
          key={option.value}
          onClick={() => setStoredCertoTextSize(option.value)}
          title={option.label}
          type="button"
        >
          <span>{option.value}</span>
          {!compact && <small>{option.label}</small>}
        </button>
      ))}
    </div>
  );
}
