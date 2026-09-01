const GENERIC_WORKSPACE_NAMES = new Set([
  "",
  "workspace",
  "personal focus",
  "certo work",
  "my workspace",
  "untitled",
  "new workspace",
]);

export type PlatformOnboardingProfile = {
  name?: string | null;
  alias?: string | null;
  displayName?: string | null;
  email?: string | null;
  company?: string | null;
  workspaceName?: string | null;
  platformOnboardedAt?: unknown;
};

export function isGenericWorkspaceName(value?: string | null) {
  return GENERIC_WORKSPACE_NAMES.has(String(value || "").trim().toLowerCase());
}

export function platformProfileName(profile: PlatformOnboardingProfile = {}) {
  return String(profile.name || profile.alias || profile.displayName || "").trim();
}

export function platformCompanyName(profile: PlatformOnboardingProfile = {}) {
  const company = String(profile.company || "").trim();
  if (company) return company;
  const workspaceName = String(profile.workspaceName || "").trim();
  return isGenericWorkspaceName(workspaceName) ? "" : workspaceName;
}

export function platformEmail(profile: PlatformOnboardingProfile = {}) {
  return String(profile.email || "").trim();
}

/** First-run identity for Work and Collab. Chatwoot must not own this step. */
export function needsPlatformOnboarding(profile: PlatformOnboardingProfile = {}) {
  if (profile.platformOnboardedAt) return false;
  return !(platformProfileName(profile) && platformCompanyName(profile) && platformEmail(profile));
}
