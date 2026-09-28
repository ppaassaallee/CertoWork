import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  type User,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { app, auth, db } from "../firebase";
import { PORTAL_MEMBERS_COLLECTION } from "./collections";

const EMAIL_STORAGE_KEY = "certo.portal.emailForSignIn";
const portalFunctions = () => getFunctions(app, "us-central1");

export function portalAuthContinueUrl() {
  if (typeof window === "undefined") return "/portal/auth";
  return `${window.location.origin}/portal/auth`;
}

export async function portalLoginPrecheck(email: string) {
  const callable = httpsCallable(portalFunctions(), "portalLoginPrecheck");
  const result = await callable({ email: email.trim().toLowerCase() });
  return result.data as { ok: boolean; reason?: string; clientIds?: string[]; locale?: string };
}

export async function sendPortalMagicLink(email: string) {
  const normalized = email.trim().toLowerCase();
  const precheck = await portalLoginPrecheck(normalized);
  if (!precheck.ok) {
    const err = new Error(precheck.reason === "revoked" ? "revoked" : "not-invited");
    throw err;
  }
  await sendSignInLinkToEmail(auth, normalized, {
    url: portalAuthContinueUrl(),
    handleCodeInApp: true,
  });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(EMAIL_STORAGE_KEY, normalized);
  }
  return precheck;
}

export function storedPortalEmail() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(EMAIL_STORAGE_KEY) || "";
}

export function clearStoredPortalEmail() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EMAIL_STORAGE_KEY);
}

export function isPortalEmailLink(href = typeof window !== "undefined" ? window.location.href : "") {
  return isSignInWithEmailLink(auth, href);
}

export async function completePortalEmailLink(email?: string) {
  const href = typeof window !== "undefined" ? window.location.href : "";
  if (!isSignInWithEmailLink(auth, href)) {
    throw new Error("not-email-link");
  }
  const resolved = (email || storedPortalEmail()).trim().toLowerCase();
  if (!resolved) throw new Error("email-required");
  const cred = await signInWithEmailLink(auth, resolved, href);
  clearStoredPortalEmail();
  await ensurePortalClaims();
  return cred.user;
}

export async function ensurePortalClaims() {
  const callable = httpsCallable(portalFunctions(), "portalEnsureClaims");
  const result = await callable({});
  await auth.currentUser?.getIdToken(true);
  return result.data as { ok: boolean; clientIds: string[] };
}

export function isPortalUser(user: User | null) {
  if (!user) return false;
  return Boolean((user as any)?.reloadUserInfo?.customAttributes?.includes('"portal":true'));
}

/** Read claims from a fresh ID token result. */
export async function getPortalClaims() {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult(true);
  if (token.claims.portal !== true) return null;
  return {
    portal: true as const,
    workspaceId: String(token.claims.workspaceId || ""),
    clientIds: Array.isArray(token.claims.clientIds)
      ? (token.claims.clientIds as string[])
      : [],
  };
}

export async function loadPortalMember(uid: string) {
  const snap = await getDoc(doc(db, PORTAL_MEMBERS_COLLECTION, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as Record<string, unknown>;
}

export async function touchPortalLastSeen(uid: string) {
  await updateDoc(doc(db, PORTAL_MEMBERS_COLLECTION, uid), {
    lastSeenAt: new Date().toISOString(),
  }).catch(() => undefined);
}
