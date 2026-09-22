import type { Conversation } from "../../lib/collab/types";
import { Bot, Sparkles, Users, X } from "../../components/ui/Icon";

type Props = {
  conversation: Conversation | null;
  collapsed: boolean;
  onToggle: () => void;
  onOpenOdysseus?: () => void;
};

/** Right context pane: anchor summary, participants, Odysseus action stubs. */
export function CollabContextPane({
  conversation,
  collapsed,
  onToggle,
  onOpenOdysseus,
}: Props) {
  if (collapsed) {
    return (
      <aside className="do-collab-context is-collapsed" aria-label="Context">
        <button
          type="button"
          className="do-collab-context-expand"
          onClick={onToggle}
          aria-label="Show context"
          title="Show context"
        >
          <Users size={16} />
        </button>
      </aside>
    );
  }

  const anchor = conversation?.anchor;
  const participants = conversation?.participantIds || [];
  const agents = conversation?.agentIds || [];

  return (
    <aside className="do-collab-context" aria-label="Context" data-testid="collab-context-pane">
      <header className="do-collab-context-header">
        <h2>Context</h2>
        <button
          type="button"
          className="do-collab-icon-btn"
          onClick={onToggle}
          aria-label="Hide context"
          title="Hide context"
        >
          <X size={16} />
        </button>
      </header>

      {!conversation ? (
        <p className="do-collab-context-empty">Select a conversation to see details.</p>
      ) : (
        <div className="do-collab-context-body">
          <section className="do-collab-context-section">
            <h3>Anchor</h3>
            {anchor ? (
              <div className="do-collab-context-card">
                <span className="do-collab-context-kicker">{anchor.type}</span>
                <p className="do-collab-context-title">{anchor.label || conversation.title}</p>
                <p className="do-collab-muted">id · {anchor.id}</p>
              </div>
            ) : (
              <p className="do-collab-muted">No linked project or item.</p>
            )}
          </section>

          <section className="do-collab-context-section">
            <h3>Participants</h3>
            {participants.length === 0 ? (
              <p className="do-collab-muted">None listed yet.</p>
            ) : (
              <ul className="do-collab-context-list">
                {participants.map((id) => (
                  <li key={id}>
                    <Users size={14} />
                    <span title={id}>
                      {id === conversation.createdBy ? "Owner" : "Member"} · {id.slice(0, 8)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {agents.length > 0 ? (
              <ul className="do-collab-context-list">
                {agents.map((id) => (
                  <li key={id}>
                    <Bot size={14} />
                    <span>{id}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="do-collab-context-section">
            <h3>Odysseus</h3>
            <p className="do-collab-muted">Ask Odysseus about this thread or summarize later.</p>
            <div className="do-collab-context-actions">
              <button type="button" className="do-collab-btn-secondary" disabled title="Coming soon">
                <Sparkles size={14} /> Summarize
              </button>
              <button type="button" className="do-collab-btn-secondary" disabled title="Coming soon">
                Extract actions
              </button>
              <button
                type="button"
                className="do-collab-btn-primary"
                onClick={onOpenOdysseus}
                disabled={!onOpenOdysseus}
              >
                Open Odysseus
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
