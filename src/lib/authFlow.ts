export const AUTH_BOOT_TIMEOUT_MS = 6_000;
export const AUTH_POPUP_TIMEOUT_MS = 25_000;

export function authErrorCode(reason: unknown) {
  if (!reason || typeof reason !== "object") return "";
  const code = "code" in reason ? String(reason.code || "") : "";
  return code.replace(/^auth\//, "");
}

export function authErrorMessage(reason: unknown) {
  const code = authErrorCode(reason);
  const message = reason instanceof Error ? reason.message : "";

  if (message.includes("timed out")) {
    return "Google did not finish the sign-in. Close the Google tab and use full-page sign-in below.";
  }

  switch (code) {
    case "popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups or use full-page sign-in.";
    case "popup-closed-by-user":
    case "cancelled-popup-request":
      return "Sign-in was cancelled. Try again when you are ready.";
    case "unauthorized-domain":
      return "This Certo Work address is not authorized for Google sign-in. Contact the workspace owner.";
    case "web-storage-unsupported":
    case "operation-not-supported-in-this-environment":
      return "This browser is blocking the secure session. Allow site storage or use a regular browser window.";
    case "network-request-failed":
      return "The sign-in service could not be reached. Check your connection and try again.";
    case "account-exists-with-different-credential":
      return "This email already uses a different sign-in method.";
    case "email-already-in-use":
      return "This email already has an account. Use Sign in or reset your password.";
    case "invalid-email":
      return "Enter a valid email address.";
    case "invalid-credential":
    case "wrong-password":
    case "user-not-found":
      return "The email or password is not correct.";
    case "weak-password":
      return "Use a stronger password with at least 6 characters.";
    case "too-many-requests":
      return "Too many attempts. Wait a moment, then try again or reset your password.";
    default:
      return "Sign-in could not be completed. Try again or reset your password.";
  }
}

export function withAuthTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
