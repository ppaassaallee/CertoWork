/**
 * Outlook provider stub — enabled when MS_* secrets exist (Phase 3 Step 29).
 * Full Graph implementation lives in functions/src/calendar/outlookProvider.ts
 * when credentials are configured; until then Connect Outlook stays disabled.
 */
export const outlookNotConfiguredMessage =
  "Set MS_OAUTH_CLIENT_ID, MS_OAUTH_CLIENT_SECRET, MS_TENANT and VITE_MS_OAUTH_CLIENT_ID";
