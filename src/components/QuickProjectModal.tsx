import { useEffect, useState } from "react";
import { FolderPlus, WandSparkles, X } from "./ui/Icon";

type QuickProjectInput = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
};

type QuickProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: QuickProjectInput) => Promise<void>;
  onUseWizard: () => void;
};

const EMPTY: QuickProjectInput = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
};

export function QuickProjectModal({
  isOpen,
  onClose,
  onCreate,
  onUseWizard,
}: QuickProjectModalProps) {
  const [draft, setDraft] = useState<QuickProjectInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setDraft(EMPTY);
    setError("");
    setSaving(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (patch: Partial<QuickProjectInput>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const create = async () => {
    if (saving) return;
    const title = draft.title.trim();
    if (!title) {
      setError("Add a project name.");
      return;
    }
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      setError("The start date has to be on or before the end date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCreate({ ...draft, title });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The project could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div aria-label="New project" aria-modal="true" className="do-skill-layer" role="dialog">
      <section className="do-skill-modal do-quick-project-modal" data-testid="quick-project-modal">
        <header className="do-skill-head">
          <div className="do-skill-title">
            <span><FolderPlus size={18} /></span>
            <div>
              <small>Project</small>
              <h2>New project</h2>
              <p>Name, dates, and a short description. The wizard stays available if you want the full setup.</p>
            </div>
          </div>
          <button aria-label="Close new project" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="do-skill-body do-quick-project-body">
          <label className="do-skill-field">
            <span>Project name</span>
            <input
              aria-label="Project name"
              data-testid="quick-project-name"
              onChange={(event) => update({ title: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void create();
                }
              }}
              placeholder="e.g. KruOps Marketplace"
              value={draft.title}
            />
          </label>
          <div className="do-skill-grid">
            <label className="do-skill-field">
              <span>Start date</span>
              <input
                aria-label="Start date"
                data-testid="quick-project-start"
                onChange={(event) => update({ startDate: event.target.value })}
                type="date"
                value={draft.startDate}
              />
            </label>
            <label className="do-skill-field">
              <span>End date</span>
              <input
                aria-label="End date"
                data-testid="quick-project-end"
                onChange={(event) => update({ endDate: event.target.value })}
                type="date"
                value={draft.endDate}
              />
            </label>
          </div>
          <label className="do-skill-field">
            <span>Description</span>
            <textarea
              aria-label="Description"
              data-testid="quick-project-description"
              onChange={(event) => update({ description: event.target.value })}
              placeholder="What this project is for."
              value={draft.description}
            />
          </label>
          {error ? <p className="do-skill-error">{error}</p> : null}
        </div>
        <footer className="do-skill-foot">
          <button data-testid="quick-project-wizard" onClick={onUseWizard} type="button">
            <WandSparkles size={14} /> Use the wizard
          </button>
          <div>
            <button onClick={onClose} type="button">Cancel</button>
            <button
              className="do-skill-create"
              data-testid="quick-project-create"
              disabled={!draft.title.trim() || saving}
              onClick={() => void create()}
              type="button"
            >
              {saving ? "Creating..." : "Create project"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
