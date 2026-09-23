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

export function isFirestoreQuotaMessage(message: string) {
  return /data service has reached its usage limit|quota exceeded|daily quota|resource-exhausted/i.test(
    String(message || ""),
  );
}

export function workspaceLoadErrorMessage(error: unknown) {
  if (isFirestoreQuotaError(error)) {
    return "Certo Work's data service has reached its usage limit. Your account and connection are not the problem. An admin needs to check Firebase Firestore usage and billing before you can try again.";
  }
  const code = errorCode(error);
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "Certo Work couldn't access your workspace. Ask an admin to check your workspace membership and data permissions.";
  }
  if (code === "unavailable" || code === "deadline-exceeded" || /timed out|not confirmed by server/i.test(errorMessage(error))) {
    return "Certo Work couldn't confirm your workspace data right now. Your records have not been cleared by this error. Wait a moment and try again; if it continues, ask an admin to check Firestore availability and usage.";
  }
  return "Your workspace could not be opened. Check your connection and try again.";
}

/** Firebase project used by Certo Work production (from Worker FIREBASE_PROJECT_ID). */
export const CERTO_FIREBASE_PROJECT_ID = "gen-lang-client-0277783597";

export function firestoreUsageConsoleUrl(projectId = CERTO_FIREBASE_PROJECT_ID) {
  return `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/usage/details`;
}
