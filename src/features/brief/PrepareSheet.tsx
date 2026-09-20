import { useEffect, useState } from "react";
import { DButton, DSheet } from "../../desktop/ui";

export type PrepareSheetProps = {
  open: boolean;
  onClose: () => void;
  meetingTitle: string;
  attendees?: string[];
  projectName?: string;
  linkedItems?: Array<{ id: string; title: string }>;
  notes?: string[];
  openItems?: Array<{ id: string; title: string; due?: string }>;
  onOpenProject?: () => void;
  onAddNote?: () => void;
  onAskOdysseus?: () => void;
  whatToBring?: string[] | null;
  loadWhatToBring?: () => Promise<string[]>;
};

export function PrepareSheet({
  open,
  onClose,
  meetingTitle,
  attendees = [],
  projectName,
  linkedItems = [],
  notes = [],
  openItems = [],
  onOpenProject,
  onAddNote,
  onAskOdysseus,
  whatToBring,
  loadWhatToBring,
}: PrepareSheetProps) {
  const [bring, setBring] = useState<string[]>(whatToBring || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (whatToBring?.length) {
      setBring(whatToBring);
      return;
    }
    if (!loadWhatToBring) {
      setBring(openItems.map((i) => i.title));
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadWhatToBring()
      .then((list) => {
        if (!cancelled) setBring(list.length ? list : openItems.map((i) => i.title));
      })
      .catch(() => {
        if (!cancelled) setBring(openItems.map((i) => i.title));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, whatToBring, loadWhatToBring, openItems]);

  return (
    <DSheet
      footer={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <DButton onClick={onOpenProject}>Open project</DButton>
          <DButton onClick={onAddNote} variant="secondary">
            Add note
          </DButton>
          <DButton onClick={onAskOdysseus} variant="ghost">
            Ask Odysseus
          </DButton>
        </div>
      }
      onClose={onClose}
      open={open}
      title={`Prepare: ${meetingTitle}`}
    >
      {attendees.length ? (
        <section style={{ marginBottom: 14 }}>
          <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#6B7280" }}>Attendees</h4>
          <p style={{ margin: 0 }}>{attendees.join(", ")}</p>
        </section>
      ) : null}
      {projectName ? (
        <section style={{ marginBottom: 14 }}>
          <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#6B7280" }}>Project</h4>
          <p style={{ margin: 0 }}>{projectName}</p>
        </section>
      ) : null}
      {linkedItems.length ? (
        <section style={{ marginBottom: 14 }}>
          <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#6B7280" }}>Linked items</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {linkedItems.map((i) => (
              <li key={i.id}>{i.title}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {notes.length ? (
        <section style={{ marginBottom: 14 }}>
          <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#6B7280" }}>Recent notes</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {notes.slice(0, 3).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section style={{ marginBottom: 14 }}>
        <h4 style={{ margin: "0 0 6px", fontSize: 12, color: "#6B7280" }}>What to bring</h4>
        {loading ? <p>Thinking…</p> : null}
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {(bring.length ? bring : ["Review open items before the call"]).map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </section>
    </DSheet>
  );
}
