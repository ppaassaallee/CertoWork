import { useEffect, useState, type ReactNode } from "react";
import { DButton, DChip } from "../../desktop/ui";
import { dismissSignal, listOpenSignals, snoozeSignal } from "./signalStore";
import { SignalCard } from "./SignalCard";
import type { Signal } from "./types";
import { renderOdysseusAnswer, type OdysseusAnswer } from "../odysseus/renderOdysseusAnswer";
import "../../desktop/ui/desktop-ui.css";

export type OdysseusSignalsPanelProps = {
  workspaceId?: string;
  uid?: string;
  contextChips?: string[];
  onSend?: (text: string) => Promise<OdysseusAnswer | string>;
  onSignalAction?: (type: string, signal: Signal) => void;
  headerExtra?: ReactNode;
};

export function OdysseusSignalsPanel({
  workspaceId,
  uid,
  contextChips = ["Today's brief", "Daily Plan"],
  onSend,
  onSignalAction,
  headerExtra,
}: OdysseusSignalsPanelProps) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "ody"; body: ReactNode }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workspaceId || !uid) return;
    listOpenSignals(workspaceId, uid).then(setSignals);
  }, [workspaceId, uid]);

  const handleAction = async (type: string, signal: Signal) => {
    if (!workspaceId) return;
    if (type === "dismiss") {
      await dismissSignal(workspaceId, signal.id);
      setSignals((s) => s.filter((x) => x.id !== signal.id));
    } else if (type === "snooze") {
      await snoozeSignal(workspaceId, signal.id, 7);
      setSignals((s) => s.filter((x) => x.id !== signal.id));
    }
    onSignalAction?.(type, signal);
  };

  const send = async (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", body: text }]);
    setInput("");
    if (!onSend) return;
    setBusy(true);
    try {
      const answer = await onSend(text);
      setMessages((m) => [
        ...m,
        {
          role: "ody",
          body: typeof answer === "string" ? answer : renderOdysseusAnswer(answer),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="d-ody-panel" data-testid="odysseus-signals-panel">
      <div style={{ padding: 12, borderBottom: "1px solid var(--c-line)" }}>
        <strong>Odysseus</strong>
        {headerExtra}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        {signals.map((s) => (
          <SignalCard key={s.id} onAction={handleAction} signal={s} />
        ))}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 10,
              background: m.role === "user" ? "#fff" : "rgba(37,71,196,.06)",
              fontSize: 13,
            }}
          >
            {m.body}
          </div>
        ))}
      </div>
      <div style={{ padding: 12, borderTop: "1px solid var(--c-line)" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {contextChips.map((c) => (
            <DChip key={c} onClick={() => void send(`Expand: ${c}`)}>
              {c}
            </DChip>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            aria-label="Message Odysseus"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send(input);
            }}
            placeholder="Ask Odysseus…"
            style={{
              flex: 1,
              border: "1px solid var(--c-line)",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 13,
            }}
            value={input}
          />
          <DButton disabled={busy} onClick={() => void send(input)} size="sm">
            Send
          </DButton>
        </div>
      </div>
    </aside>
  );
}

export { SignalCard } from "./SignalCard";
export * from "./signalStore";
export type { Signal } from "./types";
