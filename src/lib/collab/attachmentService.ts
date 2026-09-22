import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import type { MessageAttachment } from "./types";

const MAX_BYTES = 25 * 1024 * 1024;

export async function uploadAttachment(input: {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  file: File | Blob;
  name?: string;
}): Promise<MessageAttachment> {
  const name = input.name || (input.file instanceof File ? input.file.name : "file");
  const size = input.file.size;
  if (size > MAX_BYTES) {
    throw new Error("Attachments must be 25 MB or smaller.");
  }
  const mime =
    (input.file instanceof File && input.file.type) ||
    (input.file as Blob).type ||
    "application/octet-stream";
  const storagePath = `workspaces/${input.workspaceId}/collab/${input.conversationId}/${input.messageId}/${Date.now()}-${name}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, input.file);
  const url = await getDownloadURL(fileRef);
  return {
    id: `${Date.now()}`,
    name,
    url,
    mime,
    size,
    storagePath,
  };
}

/** Resize image client-side to max 1600px before upload when possible. */
export async function maybeResizeImage(file: File, maxEdge = 1600): Promise<File | Blob> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap === "undefined") {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type || "image/jpeg", 0.85),
    );
    return blob || file;
  } catch {
    return file;
  }
}
