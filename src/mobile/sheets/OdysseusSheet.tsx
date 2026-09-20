import { useState } from "react";
import { MButton, MChip, MSheet } from "../ui";
import { useMobileChrome } from "../MobileChromeContext";
import { useEffect } from "react";

export function OdysseusSheet({
  open,
  onClose,
  anchor,
  suggestions,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  anchor: string;
  suggestions: string[];
  onSend: (prompt: string) => void;
}) {
  const { setSheetOpen, setKeyboardUp } = useMobileChrome();
  const [text, setText] = useState("");

  useEffect(() => {
    setSheetOpen(open);
    if (!open) setKeyboardUp(false);
  }, [open, setSheetOpen, setKeyboardUp]);

  return (
    <MSheet
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <input
            onBlur={() => setKeyboardUp(false)}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setKeyboardUp(true)}
            placeholder="Ask Odysseus…"
            style={{
              flex: 1,
              minHeight: 44,
              border: "1px solid var(--c-line)",
              borderRadius: 10,
              padding: "0 12px",
              fontSize: 16,
            }}
            value={text}
          />
          <MButton
            disabled={!text.trim()}
            onClick={() => {
              onSend(text.trim());
              setText("");
              onClose();
            }}
            size="sm"
          >
            Send
          </MButton>
        </div>
      }
      onClose={onClose}
      open={open}
      snap={0.45}
      title="Odysseus"
    >
      <p className="m-caption" style={{ marginBottom: 10 }}>
        {anchor}
      </p>
      <div className="m-chip-row">
        {suggestions.map((s) => (
          <MChip
            key={s}
            onClick={() => {
              onSend(s);
              onClose();
            }}
          >
            {s}
          </MChip>
        ))}
      </div>
    </MSheet>
  );
}
