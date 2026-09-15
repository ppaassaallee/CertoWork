import { useEffect, useRef, useState } from "react";
import type { RitualCardProps } from "./types";
import "./choice.css";

type ChoiceOption = {
  id: string;
  title: string;
  hint?: string;
  tone?: "success" | "warning" | "danger" | "neutral";
};

export function ChoiceCard({
  props,
  value,
  onChange,
}: RitualCardProps) {
  const options = (Array.isArray(props?.options) ? props.options : []) as ChoiceOption[];
  const columns = (props?.columns === 1 ? 1 : 3) as 1 | 3;
  const selected = typeof value === "string" ? value : "";
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!rootRef.current) return;
      if (event.key >= "1" && event.key <= "9") {
        const idx = Number(event.key) - 1;
        if (options[idx]) {
          event.preventDefault();
          onChange(options[idx].id);
          setFocusIndex(idx);
        }
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setFocusIndex((current) => {
          const next =
            event.key === "ArrowLeft"
              ? Math.max(0, current - 1)
              : Math.min(options.length - 1, current + 1);
          return next;
        });
      }
      if (event.key === "Enter" && options[focusIndex]) {
        event.preventDefault();
        onChange(options[focusIndex].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options, focusIndex, onChange]);

  return (
    <div
      className={`cw-ritual-choice cw-ritual-choice--cols-${columns}`}
      data-testid="card-choice"
      ref={rootRef}
    >
      {options.map((option, index) => (
        <button
          className={`cw-ritual-choice-card tone-${option.tone || "neutral"} ${
            selected === option.id ? "is-selected" : ""
          } ${focusIndex === index ? "is-focused" : ""}`}
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          <strong>{option.title}</strong>
          {option.hint ? <em>{option.hint}</em> : null}
        </button>
      ))}
    </div>
  );
}
