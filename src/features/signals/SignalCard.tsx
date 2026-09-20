import { DButton } from "../../desktop/ui";
import type { Signal } from "./types";
import "../brief/brief.css";

export function SignalCard({
  signal,
  onAction,
}: {
  signal: Signal;
  onAction: (type: string, signal: Signal) => void;
}) {
  const time = relativeTime(signal.createdAt);
  return (
    <article className="d-signal">
      <div className="kicker">Signal detected · {time}</div>
      <h4 style={{ margin: "6px 0 4px", fontSize: 14 }}>{signal.title}</h4>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--c-ink-2)" }}>{signal.body}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {signal.actions.map((a) => (
          <DButton
            key={a.type + a.label}
            onClick={() => onAction(a.type, signal)}
            size="sm"
            variant={a.type === "dismiss" || a.type === "snooze" ? "ghost" : "primary"}
          >
            {a.label}
          </DButton>
        ))}
      </div>
    </article>
  );
}

function relativeTime(raw: unknown): string {
  try {
    const ms =
      typeof raw === "string"
        ? new Date(raw).getTime()
        : typeof (raw as { toMillis?: () => number })?.toMillis === "function"
          ? (raw as { toMillis: () => number }).toMillis()
          : Date.now();
    const mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  } catch {
    return "recently";
  }
}
