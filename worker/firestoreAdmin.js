/**
 * Minimal Firestore Admin REST helpers for Cloudflare Workers.
 * Uses FIREBASE_SERVICE_ACCOUNT JSON when present.
 */

const FIREBASE_PROJECT_ID = "gen-lang-client-0277783597";
const FIRESTORE_DATABASE_ID = "ai-studio-0db18e51-58a2-4763-a4d7-3fced116347d";
const FIREBASE_WEB_API_KEY = "AIzaSyDa-1rva5k-ky_f6L4A6lenqz8cBUP6Hn4";

function parseServiceAccount(env = {}) {
  const raw = String(env.FIREBASE_SERVICE_ACCOUNT || env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function projectId(env = {}) {
  return env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID;
}

function databaseId(env = {}) {
  return env.FIRESTORE_DATABASE_ID || FIRESTORE_DATABASE_ID;
}

function base64Url(bytes) {
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeJwtPart(value) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToArrayBuffer(pem) {
  const cleaned = String(pem || "")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function googleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${encodeJwtPart(header)}.${encodeJwtPart(claim)}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Could not mint Firestore access token");
  }
  return String(payload.access_token);
}

function encodeFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => encodeFirestoreValue(item)) } };
  }
  if (typeof value === "object") {
    if (value.__timestamp === true || value instanceof Date) {
      const date = value instanceof Date ? value : new Date();
      return { timestampValue: date.toISOString() };
    }
    const fields = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      fields[key] = encodeFirestoreValue(item);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function encodeFirestoreDocument(data) {
  const fields = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined) continue;
    fields[key] = encodeFirestoreValue(value);
  }
  return { fields };
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    return (value.arrayValue?.values || []).map((item) => decodeFirestoreValue(item));
  }
  if ("mapValue" in value) return decodeFirestoreDocument(value.mapValue?.fields || {});
  return null;
}

export function decodeFirestoreDocument(fields = {}) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = decodeFirestoreValue(value);
  }
  return out;
}

export async function firestoreGetDocument(env, collection, docId) {
  const project = projectId(env);
  const database = databaseId(env);
  const path = `projects/${project}/databases/${encodeURIComponent(database)}/documents/${collection}/${encodeURIComponent(docId)}`;
  const serviceAccount = parseServiceAccount(env);
  if (serviceAccount) {
    const token = await googleAccessToken(serviceAccount);
    const response = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Firestore get failed (${response.status})`);
    const payload = await response.json();
    return { id: docId, ...decodeFirestoreDocument(payload.fields || {}) };
  }
  const apiKey = env.FIREBASE_WEB_API_KEY || FIREBASE_WEB_API_KEY;
  const response = await fetch(`https://firestore.googleapis.com/v1/${path}?key=${apiKey}`);
  if (response.status === 404) return null;
  if (!response.ok) return null;
  const payload = await response.json();
  return { id: docId, ...decodeFirestoreDocument(payload.fields || {}) };
}

export async function firestoreCreateDocument(env, collection, data, docId = "") {
  const serviceAccount = parseServiceAccount(env);
  if (!serviceAccount) {
    return { ok: false, reason: "FIREBASE_SERVICE_ACCOUNT not configured" };
  }
  const token = await googleAccessToken(serviceAccount);
  const project = projectId(env);
  const database = databaseId(env);
  const parent = `projects/${project}/databases/${encodeURIComponent(database)}/documents`;
  const url = docId
    ? `https://firestore.googleapis.com/v1/${parent}/${collection}?documentId=${encodeURIComponent(docId)}`
    : `https://firestore.googleapis.com/v1/${parent}/${collection}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(encodeFirestoreDocument(data)),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      reason: payload?.error?.message || `Firestore create failed (${response.status})`,
    };
  }
  const name = String(payload.name || "");
  const id = name.split("/").pop() || docId;
  return { ok: true, id };
}

export function firestoreAdminConfigured(env = {}) {
  return Boolean(parseServiceAccount(env));
}
