/** Full page reload is opt-in. Workspace switches remount data through workspace id. */
export function shouldReloadWorkspace(options?: { reload?: boolean }) {
  return options?.reload === true;
}
