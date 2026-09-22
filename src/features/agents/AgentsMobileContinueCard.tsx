import { isAgentsJobsEnabled } from "./agentJobsFlag";
import "./agentBuilder.css";

/** Phone shell: builder is desktop-only (B10). */
export function AgentsMobileContinueCard() {
  if (!isAgentsJobsEnabled()) return null;
  return (
    <div className="ag-mobile-desktop-card" data-testid="agents-mobile-desktop">
      <strong>Continue on desktop</strong>
      <p>The agent builder needs a wider canvas. Open Certo on desktop to create or edit agents.</p>
    </div>
  );
}
