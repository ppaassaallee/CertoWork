export type WorkspaceRole = 'Owner' | 'Admin' | 'Project Manager' | 'Member' | 'Contributor' | 'Viewer';

export type WorkspaceAction =
  | 'workspace.update'
  | 'workspace.delete'
  | 'member.invite'
  | 'member.remove'
  | 'member.updateRole'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'project.archive'
  | 'project.updateStage'
  | 'project.updateHealth'
  | 'milestone.create'
  | 'milestone.update'
  | 'milestone.delete'
  | 'task.create'
  | 'task.update'
  | 'task.assign'
  | 'task.delete'
  | 'settings.update'
  | 'boldi.tell_me'
  | 'boldi.co_work'
  | 'boldi.bulk_update'
  | 'boldi.destructive_action';

const rolePermissions: Record<WorkspaceRole, Set<WorkspaceAction>> = {
  'Owner': new Set<WorkspaceAction>([
    'workspace.update',
    'workspace.delete',
    'member.invite',
    'member.remove',
    'member.updateRole',
    'project.create',
    'project.update',
    'project.delete',
    'project.archive',
    'project.updateStage',
    'project.updateHealth',
    'milestone.create',
    'milestone.update',
    'milestone.delete',
    'task.create',
    'task.update',
    'task.assign',
    'task.delete',
    'settings.update',
    'boldi.tell_me',
    'boldi.co_work',
    'boldi.bulk_update',
    'boldi.destructive_action'
  ]),
  'Admin': new Set<WorkspaceAction>([
    'workspace.update',
    'member.invite',
    'member.remove',
    'member.updateRole',
    'project.create',
    'project.update',
    'project.delete',
    'project.archive',
    'project.updateStage',
    'project.updateHealth',
    'milestone.create',
    'milestone.update',
    'milestone.delete',
    'task.create',
    'task.update',
    'task.assign',
    'task.delete',
    'settings.update',
    'boldi.tell_me',
    'boldi.co_work',
    'boldi.bulk_update'
  ]),
  'Project Manager': new Set<WorkspaceAction>([
    'project.create',
    'project.update',
    'project.archive',
    'project.updateStage',
    'project.updateHealth',
    'milestone.create',
    'milestone.update',
    'milestone.delete',
    'task.create',
    'task.update',
    'task.assign',
    'task.delete',
    'boldi.tell_me',
    'boldi.co_work'
  ]),
  'Member': new Set<WorkspaceAction>([
    'task.create',
    'task.update',
    'task.assign',
    'boldi.tell_me'
  ]),
  'Contributor': new Set<WorkspaceAction>([
    'task.update',
    'boldi.tell_me'
  ]),
  'Viewer': new Set<WorkspaceAction>([
    'boldi.tell_me'
  ])
};

export function getRoleForUser(workspace: any, userEmail: string | null | undefined, userId: string | null | undefined): WorkspaceRole {
  if (!workspace || !userId) return 'Viewer';
  if (workspace.ownerId === userId) return 'Owner';
  if (!userEmail) return 'Viewer';
  const emailLower = userEmail.toLowerCase();
  const role = workspace.roles?.[emailLower] || workspace.roles?.[userEmail];
  if (role) {
    // Standardize role cases
    if (role === 'Admin') return 'Admin';
    if (role === 'Project Manager') return 'Project Manager';
    if (role === 'Member') return 'Member';
    if (role === 'Contributor') return 'Contributor';
    if (role === 'Viewer') return 'Viewer';
  }
  return 'Member'; // default role for joined members
}

export function canPerform(role: WorkspaceRole, action: WorkspaceAction): boolean {
  return rolePermissions[role]?.has(action) || false;
}
