import assert from "node:assert/strict";
import test from "node:test";

import { authErrorCode, authErrorMessage } from "../src/lib/authFlow";

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
