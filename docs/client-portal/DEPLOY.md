# Client Portal — Deploy

Commands that cannot be run from this agent environment. Run from a machine with Firebase CLI + project access.

## Firestore rules & indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Cloud Functions (client portal)

```bash
cd functions
npm install
npm run build
firebase deploy --only \
  functions:portalLoginPrecheck,functions:portalEnsureClaims,functions:publishPortalUpdate,functions:getPortalDocumentUrl,functions:createPortalRequest,functions:portalAsk,functions:onApprovalDecided,functions:onProjectWriteForPortal,functions:onTaskWriteForPortal,functions:onClientSettingsWrite
```

Or deploy the whole functions package:

```bash
cd functions && npm run deploy
```

## Firebase Auth — email link

1. Auth → Sign-in method → Email/Password → enable **Email link (passwordless)**.
2. Authorized domains: production host + localhost.
3. Action URL / continue URL used by the app: `{origin}/portal/auth`.

## Brevo

Portal invitation / update / approval emails reuse `worker` `sendBrevoTransactionalEmail`. Ensure `BREVO_API_KEY` and `CERTO_EMAIL_FROM` are set on the Worker.

## Migration

```bash
npx tsx scripts/migrateClientPortal.ts            # dry-run
npx tsx scripts/migrateClientPortal.ts --apply    # write
```
