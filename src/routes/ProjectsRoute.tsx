import { memo } from "react";
import { ProjectCommandCenter } from "../components/ProjectSurfaces";
import { useMembers, useProjects, useTasks } from "../data";

export type ProjectsRouteProps = {
  risks: any[];
  tags?: any[];
  costTemplates?: any[];
  projectTemplates?: any[];
  actorId?: string;
  workspaceId?: string;
  canViewFinance?: boolean;
  highlightFinanceLineId?: string | null;
  initialPortfolioView?: any;
  onPortfolioViewChange?: (view: any) => void;
  onClose: () => void;
  onAsk?: (prompt: string) => void;
  onNotice?: (message: string) => void;
  onNewProject?: () => void;
  onUpdateProject: (...args: any[]) => any;
  onArchiveProject: (...args: any[]) => any;
  onDeleteProject?: (...args: any[]) => any;
  onRestoreProject: (...args: any[]) => any;
  onPermanentlyDeleteProject: (...args: any[]) => any;
  onPermanentlyDeleteProjects?: (...args: any[]) => any;
  onOpenProject: (...args: any[]) => any;
  onCreateCostTemplate?: (...args: any[]) => any;
  onUpdateCostTemplate?: (...args: any[]) => any;
  onCreateProjectTemplate?: (...args: any[]) => any;
  onDeleteProjectTemplate?: (...args: any[]) => any;
  onApplyProjectTemplate?: (...args: any[]) => any;
  onCreateControlledOption?: (...args: any[]) => any;
  onAddFinanceTask?: (...args: any[]) => any;
  onOpenWorkItem?: (...args: any[]) => any;
  onFinanceHighlightConsumed?: () => void;
};

/**
 * Portfolio / Projects page — subscribes to collection stores itself so the
 * shell does not push projects/tasks props on every snapshot. Lazy-loaded from
 * DelivereeWorkspace so ProjectSurfaces is not in the initial route chunk.
 */
function ProjectsRouteInner(props: ProjectsRouteProps) {
  const projects = useProjects();
  const tasks = useTasks();
  const workspaceMembers = useMembers() as any[];
  const { risks, ...rest } = props;

  return (
    <ProjectCommandCenter
      {...rest}
      projects={projects}
      tasks={tasks}
      risks={risks}
      workspaceMembers={workspaceMembers}
    />
  );
}

export const ProjectsRouteSuspense = memo(ProjectsRouteInner);
