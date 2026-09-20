# Daily Plan — Deploy commands

## Firestore rules + indexes (Phase 1+)

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project gen-lang-client-0277783597
```

Attempted from cloud agent: **failed** (`Failed to authenticate, have you run firebase login?`).

## Enable feature flag (Alejandro)

In Firestore console, on your user doc:

```
users/{yourUid}.flags.dailyPlan = true
```

Do not write this from the app.

## Functions (Phase 2+)

```bash
cd functions && npm install && npm run build
npx firebase deploy --only functions --project gen-lang-client-0277783597
npx firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID
npx firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
```

Client env: `VITE_GOOGLE_OAUTH_CLIENT_ID=...`

Outlook (Phase 3): `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET`, `MS_TENANT`, `VITE_MS_OAUTH_CLIENT_ID`, `VITE_MS_TENANT`.
