import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { RunDeskView, type RunTab } from "../../src/features/certo-run/CertoRunDesk";
import "../../src/index.css";

// Test-only entry, not included in Vite's production build. No subscriptions or
// Firestore seed/import. The test intercepts this endpoint with local fixture rows.
const rows = await fetch("/__run_visual_fixture").then((response) => response.json());
function Harness() {
  const [tab, setTab] = useState<RunTab>((new URLSearchParams(location.search).get("tab") || "today") as RunTab);
  return <div className="do-shell"><main className="do-main is-run-module"><RunDeskView rows={rows} workspaceId="visual-workspace" user={{uid:"visual-owner",displayName:"Alejandro Pascual"}} tab={tab} onTab={setTab} onBack={() => {}} /></main></div>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
