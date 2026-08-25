import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  authErrorCode,
  authErrorMessage,
  googleSignInBrowserAdvice,
  isLikelyInAppBrowser,
  preferredGoogleSignInMethod,
  resolveFirebaseAuthDomain,
  shouldFallbackGoogleSignInToRedirect,
} from "../src/lib/authFlow";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIREBASE_HOSTED_AUTH = "gen-lang-client-0277783597.firebaseapp.com";

test("normalizes Firebase auth error codes", () => {
  assert.equal(authErrorCode({ code: "auth/popup-blocked" }), "popup-blocked");
  assert.equal(authErrorCode(new Error("ordinary error")), "");
});

test("gives a recoverable path when the Google popup is blocked", () => {
  assert.match(authErrorMessage({ code: "auth/popup-blocked" }), /full-page sign-in/i);
});

test("explains delayed popup completion instead of leaving a spinner", () => {
  assert.match(authErrorMessage(new Error("Google sign-in timed out")), /close the Google tab/i);
});

test("reports an unauthorized deployment domain precisely", () => {
  assert.match(authErrorMessage({ code: "auth/unauthorized-domain" }), /not authorized/i);
});

test("gives useful email and password account guidance", () => {
  assert.match(authErrorMessage({ code: "auth/email-already-in-use" }), /already has an account/i);
  assert.match(authErrorMessage({ code: "auth/weak-password" }), /stronger password/i);
  assert.match(authErrorMessage({ code: "auth/invalid-credential" }), /email or password/i);
});

test("keeps Firebase-hosted authDomain on localhost and uses the app host in production", () => {
  assert.equal(resolveFirebaseAuthDomain(FIREBASE_HOSTED_AUTH, "localhost"), FIREBASE_HOSTED_AUTH);
  assert.equal(resolveFirebaseAuthDomain(FIREBASE_HOSTED_AUTH, "127.0.0.1"), FIREBASE_HOSTED_AUTH);
  assert.equal(resolveFirebaseAuthDomain(FIREBASE_HOSTED_AUTH, "certo.work"), "certo.work");
  assert.equal(resolveFirebaseAuthDomain(FIREBASE_HOSTED_AUTH, "www.certo.work"), "www.certo.work");
});

test("prefers full-page Google sign-in on iPhone and in-app browsers", () => {
  assert.equal(
    preferredGoogleSignInMethod("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"),
    "redirect",
  );
  assert.equal(
    preferredGoogleSignInMethod("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"),
    "popup",
  );
  assert.equal(
    preferredGoogleSignInMethod("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"),
    "redirect",
  );
  assert.equal(preferredGoogleSignInMethod("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5, "MacIntel"), "redirect");
});

test("detects Outlook-style in-app browsers and tells people to open Safari", () => {
  const outlook = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
  assert.equal(isLikelyInAppBrowser(outlook), true);
  assert.match(googleSignInBrowserAdvice(outlook), /Open this page in Safari/i);
  assert.equal(
    isLikelyInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"),
    false,
  );
});

test("falls back to redirect when a Google popup cannot keep session storage", () => {
  assert.equal(shouldFallbackGoogleSignInToRedirect({ code: "auth/popup-blocked" }), true);
  assert.equal(shouldFallbackGoogleSignInToRedirect({ code: "auth/popup-closed-by-user" }), false);
  assert.equal(
    shouldFallbackGoogleSignInToRedirect(new Error("Unable to process request due to missing initial state")),
    true,
  );
});

test("explains the Firebase missing-initial-state redirect failure", () => {
  assert.match(
    authErrorMessage(new Error("Unable to process request due to missing initial state. This may happen if browser sessionStorage is inaccessible")),
    /Open the page in Safari/i,
  );
});

test("production Google sign-in stays on the app origin and does not force a popup", () => {
  const firebaseSource = readFileSync(join(root, "src/lib/firebase.ts"), "utf8");
  const signInSource = readFileSync(join(root, "src/App.tsx"), "utf8");
  const inviteSource = readFileSync(join(root, "src/components/InviteActivate.tsx"), "utf8");
  assert.match(firebaseSource, /resolveFirebaseAuthDomain/);
  assert.doesNotMatch(signInSource, /handleSignIn\("popup"\)/);
  assert.doesNotMatch(inviteSource, /signIn\("popup"\)/);
});
