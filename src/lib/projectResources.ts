export const PROJECT_RESOURCE_MAX_BYTES = 20 * 1024 * 1024;

export const PROJECT_RESOURCE_TYPES = [
  { value: "file", label: "Upload file" },
  { value: "note", label: "Create note" },
  { value: "link", label: "Add link" },
  { value: "google_drive", label: "Google Drive" },
  { value: "onedrive", label: "OneDrive" },
] as const;

export type ProjectResourceType = (typeof PROJECT_RESOURCE_TYPES)[number]["value"];

export function isAllowedProjectResourceSize(bytes: number) {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= PROJECT_RESOURCE_MAX_BYTES;
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
