import { memo } from "react";
import { useMembers, useProjects, useTasks } from "../data";
import { useRisks } from "../data/packStores";
import { HomeCockpit, type HomeCockpitProps } from "../features/home/HomeCockpit";

/** Store-owned props — HomeRoute reads these so the shell can skip full arrays. */
type StoreOwned = "projects" | "tasks" | "members" | "risks";

export type HomeRouteProps = Omit<HomeCockpitProps, StoreOwned> & {
  /** Optional overrides when shell already has a filtered slice. */
  projects?: HomeCockpitProps["projects"];
  tasks?: HomeCockpitProps["tasks"];
  members?: HomeCockpitProps["members"];
  risks?: HomeCockpitProps["risks"];
};

/** Home cockpit — store-subscribed so portfolio siblings stay quiet. */
function HomeRouteInner(props: HomeRouteProps) {
  const storeProjects = useProjects();
  const storeTasks = useTasks();
  const storeMembers = useMembers();
  const storeRisks = useRisks();
  const {
    projects,
    tasks,
    members,
    risks,
    userId,
    workspaceId,
    actor,
    userName,
    ...rest
  } = props;

  return (
    <HomeCockpit
      {...rest}
      actor={actor}
      members={(members || storeMembers) as any[]}
      projects={(projects || storeProjects) as any[]}
      risks={(risks || storeRisks) as any[]}
      tasks={(tasks || storeTasks) as any[]}
      userId={userId}
      userName={userName || ""}
      workspaceId={workspaceId || ""}
    />
  );
}

export const HomeRoute = memo(HomeRouteInner);
