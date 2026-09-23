/**
 * AES-GCM token encryption for calendar OAuth refresh/access tokens.
 * Key: CALENDAR_TOKEN_KEY as 32-byte hex or utf8 secret (hashed to 32 bytes).
 *
 * OAuth `state` uses URL-safe base64 so Google callback never mangles `+` / `/`.
 */

function base64FromBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function bytesFromBase64(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64Url(value) {
  return String(value || "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const raw = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
  return raw + pad;
}

async function deriveKey(env) {
  const raw = String(env.CALENDAR_TOKEN_KEY || "").trim();
  if (!raw) throw new Error("CALENDAR_TOKEN_KEY is not configured");
  let material;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    material = new Uint8Array(raw.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
  } else {
    material = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  }
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptCalendarSecrets(env, payload) {
  const key = await deriveKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return {
    iv: base64FromBytes(iv),
    ciphertext: base64FromBytes(new Uint8Array(cipher)),
  };
}

export async function decryptCalendarSecrets(env, sealed) {
  const key = await deriveKey(env);
  const iv = bytesFromBase64(sealed.iv);
  const ciphertext = bytesFromBase64(sealed.ciphertext);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plain));
}

function stateSecret(env) {
  return String(env.CALENDAR_TOKEN_KEY || "dev");
}

/** Build a URL-safe signed OAuth state that survives Google redirects. */
export function signCalendarState(env, uid, workspaceId) {
  const iat = Date.now();
  const payload = JSON.stringify({
    uid: String(uid || ""),
    workspaceId: String(workspaceId || ""),
    iat,
  });
  const body = toBase64Url(btoa(payload));
  const sig = toBase64Url(btoa(`${body}.${stateSecret(env)}`));
  return `${body}.${sig}`;
}

export function verifyCalendarState(env, state) {
  const raw = String(state || "").trim();
  // New format: body.sig (URL-safe base64)
  if (raw.includes(".")) {
    const [body, sig] = raw.split(".");
    if (!body || !sig) return null;
    const expected = toBase64Url(btoa(`${body}.${stateSecret(env)}`));
    if (sig !== expected) return null;
    try {
      const parsed = JSON.parse(atob(fromBase64Url(body)));
      const uid = String(parsed.uid || "");
      const workspaceId = String(parsed.workspaceId || "");
      const iat = Number(parsed.iat);
      if (!uid || !workspaceId) return null;
      if (!Number.isFinite(iat) || Date.now() - iat > 15 * 60 * 1000) return null;
      return { uid, workspaceId, iat };
    } catch {
      return null;
    }
  }

  // Legacy format: uid:workspaceId:iat|btoa(...) — keep accepting briefly
  const [body, sig] = raw.split("|");
  if (!body || !sig) return null;
  const expected = btoa(body + ":" + stateSecret(env));
  if (sig !== expected) return null;
  const parts = body.split(":");
  if (parts.length < 3) return null;
  const iatRaw = parts[parts.length - 1];
  const uid = parts[0];
  const workspaceId = parts.slice(1, -1).join(":");
  if (!uid || !workspaceId) return null;
  const iat = Number(iatRaw);
  if (!Number.isFinite(iat) || Date.now() - iat > 15 * 60 * 1000) return null;
  return { uid, workspaceId, iat };
}
