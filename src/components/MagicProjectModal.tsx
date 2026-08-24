import { useState } from "react";
import { Sparkles, WandSparkles, X } from "./ui/Icon";
import { extractMagicProject, type MagicProjectBlueprint } from "../lib/magicProject";
import { useAuth } from "../lib/AuthContext";

type MagicProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (blueprint: MagicProjectBlueprint) => Promise<void>;
};

export function MagicProjectModal({ isOpen, onClose, onCreate }: MagicProjectModalProps) {
  const { user, workspace } = useAuth();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const create = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const token = user ? await user.getIdToken() : "";
      const { blueprint } = await extractMagicProject({
        text,
        token,
        userId: user?.uid || "",
        workspaceId: workspace?.id || "",
      });
      await onCreate(blueprint);
      setText("");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Magic Project could not create this project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div aria-label="Magic Project" aria-modal="true" className="do-skill-layer" role="dialog">
      <section className="do-skill-modal do-magic-modal">
        <header className="do-skill-head">
          <div className="do-skill-title">
            <span><WandSparkles size={18} /></span>
            <div>
              <small>Project Skill</small>
              <h2>Magic Project</h2>
              <p>Paste the full project definition. Certo Work will extract outcome, criteria, phases, epics, PBIs, subtasks, meetings, and a kickoff item, then save a notebook note with the source.</p>
            </div>
          </div>
          <button aria-label="Close Magic Project" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="do-skill-body do-magic-body">
          <label className="do-skill-field">
            <span>Project definition</span>
            <textarea
              aria-label="Magic project definition"
              onChange={(event) => setText(event.target.value)}
              placeholder={"# Project name\nOutcome:\nWhy it matters:\nSuccess criteria:\nBacklog:\nPBI one\n\tSubtask\nMeetings:\nKickoff"}
              value={text}
            />
          </label>
          {error && <p className="do-skill-error">{error}</p>}
        </div>
        <footer className="do-skill-foot">
          <span>Each heading and indented line becomes structure. Empty fields stay empty — nothing invented.</span>
          <div>
            <button onClick={onClose} type="button">Cancel</button>
            <button className="do-skill-create" disabled={!text.trim() || saving} onClick={create} type="button">
              {saving ? "Reading and creating..." : <><Sparkles size={14} /> Create magic project</>}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
