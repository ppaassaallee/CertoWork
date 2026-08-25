import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  existingAccountInviteMessage,
  inviteActivateErrorMessage,
  inviteCredentialsFromForm,
  isExistingAccountCreateError,
  resolveInviteAuthSession,
  shouldCreateAccountAfterSignInFailure,
} from "../src/lib/inviteActivate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function firebaseError(code: string) {
  const error = new Error(`Firebase: Error (auth/${code}).`);
  (error as { code: string }).code = `auth/${code}`;
  return error;
}

test("treats enumeration-protected sign-in failures as a cue to create the account", () => {
  assert.equal(shouldCreateAccountAfterSignInFailure(firebaseError("invalid-credential")), true);
  assert.equal(shouldCreateAccountAfterSignInFailure(firebaseError("user-not-found")), true);
  assert.equal(shouldCreateAccountAfterSignInFailure(firebaseError("network-request-failed")), false);
});

test("treats create failures as an existing account, including remapped invalid-credential", () => {
  assert.equal(isExistingAccountCreateError(firebaseError("email-already-in-use")), true);
  assert.equal(isExistingAccountCreateError(firebaseError("invalid-credential")), true);
  assert.equal(isExistingAccountCreateError(firebaseError("weak-password")), false);
});

test("signs in existing invitees before trying to create a new account", async () => {
  const calls: string[] = [];
  const result = await resolveInviteAuthSession("agustin@getboldr.ai", "current-password", {
    signInWithPassword: async () => {
      calls.push("sign-in");
    },
    createWithPassword: async () => {
      calls.push("create");
    },
  });
  assert.equal(result.status, "signed-in");
  assert.deepEqual(calls, ["sign-in"]);
});

test("creates an account when sign-in fails because the email is new", async () => {
  const result = await resolveInviteAuthSession("new@getboldr.ai", "new-password", {
    signInWithPassword: async () => {
      throw firebaseError("invalid-credential");
    },
    createWithPassword: async () => undefined,
  });
  assert.equal(result.status, "created");
});

test("does not show a raw Firebase invalid-credential error when the email already exists", async () => {
  const result = await resolveInviteAuthSession("agustin@getboldr.ai", "generated-password", {
    signInWithPassword: async () => {
      throw firebaseError("invalid-credential");
    },
    createWithPassword: async () => {
      throw firebaseError("invalid-credential");
    },
  });
  assert.equal(result.status, "existing-account");
  assert.match(inviteActivateErrorMessage(result.error, true), /already has a Certo Work account/i);
  assert.doesNotMatch(inviteActivateErrorMessage(firebaseError("invalid-credential"), true), /Firebase: Error/i);
});

test("reads autofilled invite credentials from the form, not stale React state", () => {
  const email = { name: "email", value: "  agustin@getboldr.ai " };
  const password = { name: "password", value: "autofilled-secret" };
  const form = {
    elements: {
      namedItem(name: string) {
        if (name === "email") return email;
        if (name === "password") return password;
        return null;
      },
    },
  } as unknown as HTMLFormElement;
  const credentials = inviteCredentialsFromForm(form, { email: "", password: "" });
  assert.equal(credentials.email, "agustin@getboldr.ai");
  assert.equal(credentials.password, "autofilled-secret");
});

test("invite activation never surfaces the raw Firebase invalid-credential string", () => {
  assert.equal(
    inviteActivateErrorMessage(firebaseError("invalid-credential"), true),
    existingAccountInviteMessage(),
  );
  assert.doesNotMatch(inviteActivateErrorMessage(firebaseError("invalid-credential")), /Firebase: Error/i);
});

test("invite screen signs in existing users and offers Google or reset instead of a dead create-only path", () => {
  const source = readFileSync(join(root, "src/components/InviteActivate.tsx"), "utf8");
  assert.match(source, /resolveInviteAuthSession/);
  assert.match(source, /Continue with Google/);
  assert.match(source, /Send password reset/);
  assert.match(source, /current-password/);
  assert.doesNotMatch(source, /setError\(reason instanceof Error \? reason\.message/);
});

test("invite links stay on the activation screen so an existing workspace cannot skip acceptance", () => {
  const source = readFileSync(join(root, "src/App.tsx"), "utf8");
  assert.match(source, /if \(inviteToken\) \{/);
  assert.match(source, /<InviteActivate token=\{inviteToken\} \/>/);
  assert.doesNotMatch(source, /inviteToken && \(!user \|\| !workspace\)/);
});
