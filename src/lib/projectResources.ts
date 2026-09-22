export const PROJECT_RESOURCE_MAX_BYTES = 50 * 1024 * 1024;

export const PROJECT_RESOURCE_MAX_MB = Math.round(
  PROJECT_RESOURCE_MAX_BYTES / 1024 / 1024,
);

export const PROJECT_RESOURCE_TYPES = [
  { value: "file", label: "Upload file", shortLabel: "File" },
  { value: "note", label: "Create note", shortLabel: "Note" },
  { value: "link", label: "Add link", shortLabel: "Link" },
  { value: "google_drive", label: "Google Drive", shortLabel: "Drive" },
  { value: "onedrive", label: "OneDrive", shortLabel: "OneDrive" },
] as const;

export type ProjectResourceType = (typeof PROJECT_RESOURCE_TYPES)[number]["value"];

export function isAllowedProjectResourceSize(bytes: number) {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= PROJECT_RESOURCE_MAX_BYTES;
}

export function projectResourceSizeLimitMessage() {
  return `Files must be ${PROJECT_RESOURCE_MAX_MB} MB or smaller.`;
}

export function looksLikeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function resourceTypeLabel(value?: string) {
  return PROJECT_RESOURCE_TYPES.find((item) => item.value === value)?.label || "Document";
}

export function projectDocumentMeta(document: {
  resourceType?: string;
  summary?: string;
  content?: string;
  body?: string;
  description?: string;
  url?: string;
  href?: string;
}) {
  const type = resourceTypeLabel(document.resourceType);
  const content = String(document.content || document.body || document.description || "").trim();
  if (document.summary?.trim()) return `${type} · ${document.summary.trim()}`;
  if (content) return `${type} · ${content.slice(0, 120)}`;
  const href = String(document.url || document.href || "").trim();
  if (
    href &&
    looksLikeExternalUrl(href) &&
    !href.includes("firebasestorage") &&
    !href.includes("googleapis.com/download")
  ) {
    return `${type} · ${href}`;
  }
  if (document.resourceType === "file") return "Uploaded file";
  return type;
}
