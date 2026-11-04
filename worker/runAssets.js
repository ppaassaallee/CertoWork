/** HTML routes under /run load the Run document. Files with an extension stay assets. */
export function runDocumentPath(pathname, method) {
  if (method !== "GET" && method !== "HEAD") return null;
  if (pathname !== "/run" && !pathname.startsWith("/run/")) return null;
  const last = pathname.split("/").pop() || "";
  if (last.includes(".")) return null;
  return "/run.html";
}
