import { authErrorCode, authErrorMessage } from "./authFlow";

export const INVITE_EXISTING_ACCOUNT_CODE = "invite/existing-account";

const CREATE_AFTER_SIGN_IN_CODES = new Set([
  "",
  "invalid-credential",
  "invalid-login-credentials",
  "wrong-password",
  "user-not-found",
]);

const EXISTING_ACCOUNT_CREATE_CODES = new Set([
  "email-already-in-use",
  "invalid-credential",
  "invalid-login-credentials",
  "credential-already-in-use",
  "account-exists-with-different-credential",
]);

export function existingAccountInviteMessage() {
  return "This email already has a Certo Work account. Enter the password you already use, continue with Google, or send a reset link.";
}

export function shouldCreateAccountAfterSignInFailure(reason: unknown) {
  return CREATE_AFTER_SIGN_IN_CODES.has(authErrorCode(reason));
}

export function isExistingAccountCreateError(reason: unknown) {
  return EXISTING_ACCOUNT_CREATE_CODES.has(authErrorCode(reason));
}

export function readNamedInputValue(form: HTMLFormElement | null, name: string, fallback = "") {
  const field = form?.elements.namedItem(name) as { value?: string } | null;
  const fromDom = field && typeof field.value === "string" ? field.value : "";
  return (fromDom || fallback).trim();
}

export function inviteCredentialsFromForm(
  form: HTMLFormElement | null,
  fallback: { email?: string; name?: string; password?: string } = {},
) {
  return {
    email: readNamedInputValue(form, "email", fallback.email || "").toLowerCase(),
    name: readNamedInputValue(form, "displayName", fallback.name || ""),
    password: readNamedInputValue(form, "password", fallback.password || ""),
  };
}

export function inviteActivateErrorMessage(reason: unknown, existingAccount = false) {
  const code = authErrorCode(reason);
  const raw = reason instanceof Error ? reason.message : String(reason || "");
  if (existingAccount || code === "existing-account" || raw.includes(INVITE_EXISTING_ACCOUNT_CODE)) {
    return existingAccountInviteMessage();
  }
  if (isExistingAccountCreateError(reason) || CREATE_AFTER_SIGN_IN_CODES.has(code)) {
    return existingAccount ? existingAccountInviteMessage() : authErrorMessage(reason);
  }
  if (/Firebase:\s*Error/i.test(raw)) {
    return authErrorMessage(reason);
  }
  return raw.trim() || authErrorMessage(reason);
}

type InviteAuthAdapters = {
  signInWithPassword: (email: string, password: string) => Promise<unknown>;
  createWithPassword: (email: string, password: string) => Promise<unknown>;
};

export async function resolveInviteAuthSession(
  email: string,
  password: string,
  adapters: InviteAuthAdapters,
) {
  try {
    await adapters.signInWithPassword(email, password);
    return { status: "signed-in" as const };
  } catch (signInError) {
    if (!shouldCreateAccountAfterSignInFailure(signInError)) {
      return { status: "error" as const, error: signInError };
    }
    try {
      await adapters.createWithPassword(email, password);
      return { status: "created" as const };
    } catch (createError) {
      if (isExistingAccountCreateError(createError)) {
        return { status: "existing-account" as const, error: createError };
      }
      return { status: "error" as const, error: createError };
    }
  }
}
