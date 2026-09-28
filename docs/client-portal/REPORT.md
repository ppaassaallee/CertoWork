# Client Portal — Final report

## Outcome

One authenticated client portal (`/portal`) replaces separate token links for status, invoices, requests, and collab guests. Clients authenticate via Firebase email-link; custom claims `{ portal: true, clientIds }` gate a projected `client_portal/{clientId}/…` tree written only by Cloud Functions.

## Model

- Team: `clients`, `portal_members`, `project_updates`, `client_approvals`, `portal_events`, `client_stats`
- Projection: `client_portal/{clientId}/{projects|updates|timeline|items|documents|invoices|approvals|threads|activity|csat|meta}`
- Types/zod: `src/lib/clientPortal/types.ts`, builders in `projectViews.ts`

## Functions (`functions/src/clientPortal/`)

`projectProject`, `projectItems`, `projectDocuments`, `projectInvoices`, `projectApprovals`, `projectThreads`, `publishUpdate`, `writeActivity`, callables: `portalLoginPrecheck`, `portalEnsureClaims`, `publishPortalUpdate`, `getPortalDocumentUrl`, `createPortalRequest`, `portalAsk`, triggers on project/task/client/approval writes.

## Rules / indexes

- `firestore.rules` — portal helpers; denials for portal tokens on workspace membership; projected read + limited approval/csat writes; portal_events create-by-member.
- `firestore.indexes.json` — updates, activity, items, project_updates, client_approvals composites.

## Routes / UI

- Client: lazy `src/portal/PortalApp.tsx` (shell, Home, Project, Requests, Documents, Invoices, Messages, Approvals, Profile, More, preview).
- Team: Project › More › **Client portal** (`ClientPortalTab`); `ClientsPages` for `/clients` insights shell.
- Transition banners on PublicStatusReport, PublicInvoicePortal, PublicRequestPortal, GuestPortal; App aliases `/status` and `/r`.

## Flags

- Workspace `flags.clientPortal` (team gate — document when enabling in production).
- Per-client `portalEnabled` + `PortalSettings`; per-project `clientId`; tasks `clientVisible`; attachments `clientFolder`.

## Migration

`scripts/migrateClientPortal.ts` (dry-run default; `--apply` to write). Counts: clients, projectsLinked, updatesArchived, tasksFlagged, guestsLinked.

## Notifications

`src/lib/clientPortal/emails.ts` + `worker/portalEmail.js` + `POST /api/email/portal` (Brevo).

## Routines

Recipe `client-weekly-update` (Fri 15:00) + `draftClientWeeklyUpdate` helper.

## Assumptions / deploy

See `ASSUMPTIONS.md` and `DEPLOY.md`.

## Follow-ups

- Stripe/other payment processing inside portal (links only today).
- SSO for enterprise clients.
- WhatsApp notifications.
- Nightly `client_stats` aggregator Cloud Function.
- Full ConversationThread embed in portal messages (list shell today).
- Sidebar Clients group deep wiring in DelivereeWorkspace navigation.

## Stop

Step 20 complete — continuous run finished.
