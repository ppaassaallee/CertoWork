/** Only objects in the published project's own prefix may be signed for a portal client. */
export function isPublishedDocumentPath(
  storagePath: string,
  workspaceId: string,
  projectId: string,
) {
  if (!workspaceId || !projectId || !storagePath || storagePath.includes("..")) return false;
  return storagePath.startsWith(`project-docs/${workspaceId}/${projectId}/`) &&
    storagePath.length > `project-docs/${workspaceId}/${projectId}/`.length;
}
