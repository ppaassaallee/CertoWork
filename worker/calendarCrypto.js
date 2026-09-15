/**
 * AES-GCM token encryption for calendar OAuth refresh/access tokens.
 * Key: CALENDAR_TOKEN_KEY as 32-byte hex or utf8 secret (hashed to 32 bytes).
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

export function signCalendarState(env, uid, workspaceId) {
  const iat = Date.now();
  const body = `${uid}:${workspaceId}:${iat}`;
  return `${body}|${btoa(body + ":" + String(env.CALENDAR_TOKEN_KEY || "dev"))}`;
}

export function verifyCalendarState(env, state) {
  const raw = String(state || "");
  const [body, sig] = raw.split("|");
  if (!body || !sig) return null;
  const expected = btoa(body + ":" + String(env.CALENDAR_TOKEN_KEY || "dev"));
  if (sig !== expected) return null;
  const [uid, workspaceId, iatRaw] = body.split(":");
  if (!uid || !workspaceId) return null;
  const iat = Number(iatRaw);
  if (!Number.isFinite(iat) || Date.now() - iat > 10 * 60 * 1000) return null;
  return { uid, workspaceId, iat };
}
