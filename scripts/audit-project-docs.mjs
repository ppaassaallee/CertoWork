/** Read-only inventory before rotating legacy Firebase download tokens. */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const config = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
const applet = JSON.parse(readFileSync(new URL("../firebase-applet-config.json", import.meta.url), "utf8"));
initializeApp({ projectId: applet.projectId, storageBucket: applet.storageBucket });

const db = getFirestore(config.firestore.database);
const bucket = getStorage().bucket();
const refs = new Set();
const fileRecords = await db.collection("knowledge_items").where("resourceType", "==", "file").get();
let invalidReferences = 0;
for (const record of fileRecords.docs) {
  const data = record.data();
  let path = String(data.storagePath || "");
  if (!path && typeof data.url === "string") {
    try {
      const url = new URL(data.url);
      const prefix = `/v0/b/${bucket.name}/o/`;
      if (url.hostname === "firebasestorage.googleapis.com" && url.pathname.startsWith(prefix)) {
        path = decodeURIComponent(url.pathname.slice(prefix.length));
      }
    } catch { /* Count malformed references below. */ }
  }
  if (!path.startsWith(`project-docs/${data.workspaceId}/${data.projectId}/`)) {
    invalidReferences += 1;
  } else {
    refs.add(path);
  }
}

let objectCount = 0;
let tokenCount = 0;
let unreferencedCount = 0;
const foundReferences = new Set();
let pageToken;
do {
  const [files, next] = await bucket.getFiles({
    prefix: "project-docs/",
    autoPaginate: false,
    maxResults: 1000,
    ...(pageToken ? { pageToken } : {}),
  });
  for (const file of files) {
    objectCount += 1;
    if (file.metadata?.metadata?.firebaseStorageDownloadTokens) tokenCount += 1;
    if (!refs.has(file.name)) unreferencedCount += 1;
    else foundReferences.add(file.name);
  }
  pageToken = next?.pageToken;
} while (pageToken);

// Aggregate counts only: filenames, tokens, customer IDs, and download URLs never leave this process.
console.log(JSON.stringify({
  project: applet.projectId,
  bucket: bucket.name,
  fileRecords: fileRecords.size,
  invalidReferences,
  objectCount,
  objectsWithLegacyTokens: tokenCount,
  unreferencedObjects: unreferencedCount,
  missingReferencedObjects: refs.size - foundReferences.size,
  mode: "read-only",
}, null, 2));
