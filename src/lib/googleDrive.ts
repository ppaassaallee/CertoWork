import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "./firebase";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const TOKEN_STORAGE_KEY = "certo-google-drive-token";

export type DriveFolder = {
  id: string;
  name: string;
};

export function storedDriveAccessToken() {
  if (typeof window === "undefined") return "";
  return String(window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || "");
}

export function clearDriveAccessToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function connectGoogleDrive() {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  provider.setCustomParameters({ prompt: "consent", access_type: "offline" });
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || "";
  if (!token) {
    throw new Error("Google Drive permission was not granted.");
  }
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  return token;
}

async function driveRequest(path: string, init: RequestInit = {}) {
  const token = storedDriveAccessToken();
  if (!token) throw new Error("Connect Google Drive first.");
  const response = await fetch(path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) clearDriveAccessToken();
    throw new Error(payload?.error?.message || `Google Drive request failed (${response.status})`);
  }
  return payload;
}

export async function listDriveFolders(parentId?: string | null): Promise<DriveFolder[]> {
  const parent = parentId ? `'${parentId}' in parents` : "'root' in parents";
  const query = encodeURIComponent(`${parent} and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const payload = await driveRequest(`${DRIVE_FILES_URL}?q=${query}&fields=files(id,name)&pageSize=100`);
  return (payload.files || []).map((file: { id: string; name: string }) => ({
    id: file.id,
    name: file.name,
  }));
}

export async function createDriveFolder(name: string, parentId?: string | null): Promise<DriveFolder> {
  const payload = await driveRequest(DRIVE_FILES_URL, {
    method: "POST",
    body: JSON.stringify({
      name: name.trim() || "Certo Projects",
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return { id: payload.id, name: payload.name || name };
}
