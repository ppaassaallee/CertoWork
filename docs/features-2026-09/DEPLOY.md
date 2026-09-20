# Deploy — ref-2026-09 Daily Brief + Billing

## Firestore rules
New matches: `briefs`, `signals/{workspaceId}/items`, `invoices`, `projectBilling`, `counters`, `views/{workspaceId}/definitions`.
Deploy with the repo's usual rules script, e.g.:
```bash
firebase deploy --only firestore:rules
```

## Indexes
Composite suggested:
- `invoices`: `workspaceId` + `status` + `dueDate`
- `invoices`: `workspaceId` + `projectId` + `dueDate`
- `invoices`: `workspaceId` + `projectId` + `periodStart`
- `signals/{ws}/items`: `uid` + `kind` (optional)

## Cloud Functions
```bash
cd functions && npm run build
firebase deploy --only functions:generateBrief,functions:dailyBriefRoutineTick,functions:signalRoutinesTick,functions:allocateInvoiceNumber,functions:flipOverdueInvoices,functions:generateProjectInvoices
```

## Secrets / env
- Mail: existing Brevo path; else mailto fallback for reminders.
- TTS: browser `speechSynthesis`; hide Listen when `VITE_TTS_ENABLED=0`.
- Calendar: existing Daily Plan calendar connect.

## Migration
```bash
npx tsx scripts/seedProjectBilling.ts          # dry-run
npx tsx scripts/seedProjectBilling.ts --write  # apply
```

## Feature flags
```js
// users/{uid}
{ flags: { dailyBrief: true, billing: true } }
// or localStorage: certoDailyBrief=1 / certoBilling=1
```
