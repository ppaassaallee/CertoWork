import { memo, useMemo } from "react";
import { useMembers, useProjects, useTasksIndex } from "../data";
import { useMilestonesByProject, useRisksByProject } from "../data/packStores";
import { ProjectConsolePanel } from "../components/ProjectSurfaces";

/**
 * Thin store-backed wrapper around ProjectConsolePanel.
 * Pass through all console callbacks from the shell; only data arrays come from stores.
 */
function ProjectRouteInner(props: {
  projectId: string;
  knowledgeItems?: any[];
  [key: string]: any;
}) {
  const { projectId, knowledgeItems = [], ...rest } = props;
  const projects = useProjects();
  const tasksIndex = useTasksIndex();
  const milestones = useMilestonesByProject(projectId);
  const risks = useRisksByProject(projectId);
  const members = useMembers();
  const project = useMemo(
    () => projects.find((row) => row.id === projectId) || null,
    [projects, projectId],
  );
  const tasks = tasksIndex.get(projectId) || [];
  const documents = useMemo(
    () =>
      knowledgeItems.filter(
        (item) => item.projectId === projectId && item.status !== "archived",
      ),
    [knowledgeItems, projectId],
  );

  if (!project) {
    return (
      <div className="do-panel-empty" data-testid="project-route-missing">
        <strong>Project not found</strong>
      </div>
    );
  }

  return (
    <ProjectConsolePanel
      {...(rest as any)}
      project={project}
      projects={projects}
      tasks={tasks}
      milestones={milestones}
      risks={risks}
      documents={documents}
      workspaceMembers={members as any[]}
    />
  );
}

export const ProjectRoute = memo(ProjectRouteInner);
