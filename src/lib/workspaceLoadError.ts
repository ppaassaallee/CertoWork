function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String(error.code || "").toLowerCase();
}

function errorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) return "";
  return String(error.message || "").toLowerCase();
}

export function isFirestoreQuotaError(error: unknown) {
  const code = errorCode(error);
  return code === "resource-exhausted" || code === "firestore/resource-exhausted"
    || /quota exceeded|daily quota/.test(errorMessage(error));
}

export function workspaceLoadErrorMessage(error: unknown) {
  if (isFirestoreQuotaError(error)) {
    return "Certo Work's data service has reached its usage limit. Your account and connection are not the problem. An admin needs to check Firebase Firestore usage and billing before you can try again.";
  }
  const code = errorCode(error);
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "Certo Work couldn't access your workspace. Ask an admin to check your workspace membership and data permissions.";
  }
  return "Your workspace could not be opened. Check your connection and try again.";
}
