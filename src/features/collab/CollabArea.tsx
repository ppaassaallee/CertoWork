import { MessageSquare } from "../../components/ui/Icon";
import { useCollabEnabled } from "../flags/featureUserFlags";
import { t } from "../../lib/i18n";

type Props = {
  workspaceName?: string;
  projectId?: string;
};

/** Native Collab area. Flag-off shows coming soon until Phase B surfaces land. */
export function CollabArea({ workspaceName, projectId: _projectId }: Props) {
  const enabled = useCollabEnabled();

  if (!enabled) {
    return (
      <div className="do-collab-area" data-testid="collab-area-coming-soon">
        <div className="do-collab-coming-soon">
          <MessageSquare size={28} />
          <h1>Collab</h1>
          <p>
            Native conversations for projects, items, and your team are rolling out.
            {workspaceName ? ` (${workspaceName})` : ""} Enable the Collab flag in Labs to try
            early builds. Item comments keep working until then.
          </p>
          <p className="do-collab-coming-soon-hint">{t("productBackToWork")}: use the sidebar Home.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="do-collab-area" data-testid="collab-area">
      <div className="do-collab-coming-soon">
        <MessageSquare size={28} />
        <h1>Collab</h1>
        <p>Conversation surfaces land in the next Collab steps.</p>
      </div>
    </div>
  );
}
