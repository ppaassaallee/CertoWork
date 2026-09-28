import { memo } from "react";
import { useMembers, useProjects, useTasks } from "../data";
import { MyWorkViewsSurface, type MyWorkListBodyProps } from "../features/views/MyWorkViewsSurface";

export type MyWorkRouteProps = {
  actorEmail?: string;
  actorId: string;
  actorMemberId?: string | null;
  workspaceId: string;
  preferredSystemViewId?: string | null;
  listBody: MyWorkListBodyProps;
  ctxExtras?: Record<string, unknown>;
  onOpenCollab?: (projectId: string) => void;
  onOpenItem?: (id: string) => void;
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => void | Promise<void>;
  overviewSlot?: React.ReactNode;
  sectionTasks?: any[];
};

/**
 * My Work route — owns useTasks() so DelivereeWorkspace can use useTasksWhen(false)
 * while the Projects portfolio is open.
 */
function MyWorkRouteInner({
  actorEmail,
  actorId,
  actorMemberId,
  workspaceId,
  preferredSystemViewId,
  listBody,
  ctxExtras,
  onOpenCollab,
  onOpenItem,
  onUpdateTask,
  overviewSlot,
  sectionTasks,
}: MyWorkRouteProps) {
  const projects = useProjects();
  const allTasks = useTasks();
  const members = useMembers();
  const tasks = sectionTasks || allTasks;

  return (
    <div data-testid="my-work-route">
      {overviewSlot}
      <MyWorkViewsSurface
        actorEmail={actorEmail || ""}
        actorId={actorId}
        actorMemberId={actorMemberId || null}
        ctxExtras={ctxExtras as any}
        listBody={{
          ...listBody,
          hierarchyTasks: listBody.hierarchyTasks || allTasks,
        }}
        members={members as any[]}
        onOpenCollab={onOpenCollab}
        onOpenItem={onOpenItem}
        onUpdateTask={onUpdateTask}
        preferredSystemViewId={preferredSystemViewId}
        projects={projects as any[]}
        tasks={tasks as Array<Record<string, unknown> & { id: string }>}
        workspaceId={workspaceId}
      />
    </div>
  );
}

export const MyWorkRoute = memo(MyWorkRouteInner);
