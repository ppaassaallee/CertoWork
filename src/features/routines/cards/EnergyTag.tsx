import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bookmark, CheckSquare, Flag } from "../../../components/ui/Icon";
import type { RitualCardProps } from "./types";
import "./energyTag.css";

type EnergyValue = "energizing" | "draining";

type DayItem = {
  id: string;
  title: string;
  type?: string;
  projectTitle?: string;
  status: "open" | "done" | "archived";
};

function TypeGlyph({ type }: { type?: string }) {
  const lower = String(type || "").toLowerCase();
  if (lower.includes("epic") || lower.includes("épica")) return <Bookmark size={12} />;
  if (lower.includes("bug")) return <AlertTriangle size={12} />;
  if (lower.includes("milestone") || lower.includes("hito")) return <Flag size={12} />;
  return <CheckSquare size={12} />;
}

export function EnergyTagCard({
  prepared,
  value,
  onChange,
  locale = "es",
}: RitualCardProps) {
  const summary = prepared.day_summary as { items?: DayItem[] } | undefined;
  const items = Array.isArray(summary?.items) ? summary!.items! : [];
  const tags = (value as Record<string, EnergyValue>) || {};
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const setTag = (id: string, tag: EnergyValue, advance = false) => {
    onChange({ ...tags, [id]: tag });
    if (advance) setFocusIndex((i) => Math.min(items.length - 1, i + 1));
  };

  useEffect(() => {
    if (!items.length) return;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "e" || key === "d") {
        const item = items[focusIndex];
        if (!item) return;
        event.preventDefault();
        setTag(item.id, key === "e" ? "energizing" : "draining", true);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusIndex((i) => Math.min(items.length - 1, i + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, focusIndex, tags, onChange]);

  if (!items.length) {
    return (
      <p className="cw-ritual-empty" data-testid="card-energy-tag">
        {locale === "es"
          ? "No completaste ítems hoy — está bien, seguí."
          : "You didn't complete items today — that's fine, keep going."}
      </p>
    );
  }

  return (
    <div className="cw-ritual-energy" data-testid="card-energy-tag" ref={rootRef}>
      {items.map((item, index) => {
        const current = tags[item.id];
        return (
          <div
            className={`cw-ritual-energy-row ${focusIndex === index ? "is-focused" : ""}`}
            key={item.id}
            onClick={() => setFocusIndex(index)}
          >
            <TypeGlyph type={item.type} />
            <span className="cw-ritual-energy-title">{item.title}</span>
            <div className="cw-ritual-energy-actions">
              <button
                className={`is-e ${current === "energizing" ? "is-active" : ""}`}
                onClick={() => setTag(item.id, "energizing", true)}
                type="button"
              >
                E
              </button>
              <button
                className={`is-d ${current === "draining" ? "is-active" : ""}`}
                onClick={() => setTag(item.id, "draining", true)}
                type="button"
              >
                D
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
