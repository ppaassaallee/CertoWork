import { useEffect, useState } from "react";

export type FocusRingProps = {
  value: number;
  size?: "sm" | "lg";
  label?: string;
};

function ringColor(value: number): string {
  if (value < 40) return "var(--status-danger)";
  if (value < 80) return "var(--status-warning)";
  return "var(--status-success)";
}

export function FocusRing({ value, size = "sm", label }: FocusRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const px = size === "lg" ? 28 : 18;
  const r = size === "lg" ? 11 : 6.5;
  const c = 2 * Math.PI * r;
  const [dash, setDash] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      setDash((clamped / 100) * c);
      return;
    }
    setDash(0);
    const handle = window.requestAnimationFrame(() => {
      setDash((clamped / 100) * c);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [clamped, c]);

  return (
    <span
      aria-label={label || `Focus ${clamped}%`}
      className={`cw-dayplan-ring cw-dayplan-ring--${size}`}
      title={label}
    >
      <svg height={px} viewBox={`0 0 ${px} ${px}`} width={px} aria-hidden="true">
        <circle
          cx={px / 2}
          cy={px / 2}
          fill="none"
          r={r}
          stroke="var(--border)"
          strokeWidth="3"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          fill="none"
          r={r}
          stroke={ringColor(clamped)}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          strokeWidth="3"
          style={{ transition: "stroke-dasharray 400ms ease-out" }}
          transform={`rotate(-90 ${px / 2} ${px / 2})`}
        />
        {size === "lg" ? (
          <text
            dominantBaseline="central"
            fill="var(--text-primary)"
            fontSize="13"
            fontWeight="500"
            textAnchor="middle"
            x={px / 2}
            y={px / 2}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {clamped}
          </text>
        ) : null}
      </svg>
    </span>
  );
}
