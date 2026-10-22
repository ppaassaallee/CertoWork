export function projectFilePrefix(workspaceId: string, projectId: string) {
  return `project-docs/${workspaceId}/${projectId}/`;
}

export function isProjectFilePath(path: string, workspaceId: string, projectId: string) {
  const prefix = projectFilePrefix(workspaceId, projectId);
  return Boolean(workspaceId && projectId && path.startsWith(prefix) &&
    path.length > prefix.length && !path.includes(".."));
}

export function legacyStoragePath(url: string, bucketName: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "firebasestorage.googleapis.com") return "";
    const prefix = `/v0/b/${bucketName}/o/`;
    if (!parsed.pathname.startsWith(prefix)) return "";
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return "";
  }
}
