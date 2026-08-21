export function isWorkspaceSuperAdmin(workspace?: { ownerId?: string } | null, userId?: string | null) {
  return Boolean(userId && workspace?.ownerId && workspace.ownerId === userId);
}

export function isProjectManager(project: any, userId?: string | null, memberId?: string | null) {
  if (!userId) return false;
  const managerId = String(project?.projectManagerId || "");
  return Boolean(
    managerId &&
      (managerId === userId || managerId === memberId || managerId.endsWith(`_${userId}`)),
  );
}

export function canDeleteProject(
  project: any,
  user?: { uid?: string } | null,
  workspace?: { ownerId?: string } | null,
  memberId?: string | null,
) {
  if (!user?.uid) return false;
  return isWorkspaceSuperAdmin(workspace, user.uid) || isProjectManager(project, user.uid, memberId);
}
