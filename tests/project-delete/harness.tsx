import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ProjectCommandCenter } from "../../src/components/ProjectSurfaces";
import { setLocale } from "../../src/lib/localeStore";
import "../../src/index.css";
type Row = {
  id: string;
  title: string;
  status: string;
  deletedAt?: string | null;
  updatedAt?: string;
  workspaceId: string;
  userId: string;
};
const initial: Row[] = [
  { id: "live", title: "Live project", status: "planning", workspaceId: "fixture", userId: "me" },
  {
    id: "deleted",
    title: "Deleted project",
    status: "deleted",
    deletedAt: "2026-11-24T00:00:00Z",
    workspaceId: "fixture",
    userId: "me",
  },
  {
    id: "tombstone",
    title: "Tombstone project",
    status: "active",
    deletedAt: "2026-11-24T00:00:00Z",
    workspaceId: "fixture",
    userId: "me",
  },
  { id: "completed", title: "Completed project", status: "completed", workspaceId: "fixture", userId: "me" },
];
const noop = () => {};
const tasks: [] = [],
  risks: [] = [],
  members: [] = [];
function Fixture() {
  const [projects, setProjects] = useState<Row[]>(
    () => JSON.parse(localStorage.getItem("fixture-projects") || "null") || initial,
  );
  const [reject, setReject] = useState(false);
  const update = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      if (reject) throw new Error("permission-denied");
      setProjects((previous) => {
        const next = previous.map((row) =>
          row.id === id ? { ...row, ...patch, updatedAt: new Date().toISOString() } : row,
        );
        localStorage.setItem("fixture-projects", JSON.stringify(next));
        return next;
      });
    },
    [reject],
  );
  return (
    <MemoryRouter>
      <main style={{ overflow: "auto", height: "100dvh" }}>
        <header>
          <label>
            <input type="checkbox" checked={reject} onChange={(event) => setReject(event.target.checked)} />
            Reject fixture writes
          </label>
          <button onClick={() => void update("live", { status: "active", deletedAt: null })}>
            Restore fixture project
          </button>
          <button onClick={() => void update("live", { status: "deleted", deletedAt: new Date().toISOString() })}>
            Move fixture to Deleted
          </button>
        </header>
        <ProjectCommandCenter
          projects={projects}
          tasks={tasks}
          risks={risks}
          workspaceMembers={members}
          actorId="me"
          workspaceId="fixture"
          initialPortfolioView="overview"
          onClose={noop}
          onAsk={noop}
          onNewProject={noop}
          onUpdateProject={update}
          onArchiveProject={noop}
          onDeleteProject={noop}
          onOpenProject={noop}
        />
      </main>
    </MemoryRouter>
  );
}
setLocale("en");
createRoot(document.getElementById("root")!).render(<Fixture />);
