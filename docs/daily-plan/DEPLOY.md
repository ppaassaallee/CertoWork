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

See later sections appended by Steps 14/20/31.
