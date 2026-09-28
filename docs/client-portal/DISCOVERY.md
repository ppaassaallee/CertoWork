# Client Portal — Discovery

Recorded paths and field names for projection and portal shell work.

## Project client / delivery fields

| Field | Where |
| --- | --- |
| `client`, `clientEntity` | `projects` docs; UI in `src/components/ProjectSurfaces.tsx` (~4227–4228, grouping ~5438–5495); search/keywords in `DelivereeWorkspace.tsx` (~6486, 6571) |
| `deliveryEntity`, `bpo` | Same surfaces; canonical “BPO” in `docs/certo-work-project-fields.md` |
| `stage`, `phase` | Stage → Phase checkpoints in `docs/certo-work-project-fields.md`; portfolio/reporting in `docs/data-model.md` (delivery stages) |
| `sponsorIds`, `sponsors`, `sponsor` | `ProjectSurfaces.tsx` (~2614–2618); My Work queries `sponsorIds` array-contains in `DelivereeWorkspace.tsx` / `startWorkspaceData.ts` |
| `projectManager`, `projectManagerId`, `owner`, `scrumMaster` | `ProjectSurfaces.tsx` (~1003–1424, 2586); queries in `DelivereeWorkspace.tsx` (~1052–1059) |
| `health`, progress | Automatic health/progress per `docs/certo-work-project-fields.md`; status enums in `docs/data-model.md` |
| Additive portal fields | `clientId` (Step 17 migration), `clientVisible` on tasks, `clientFolder` on attachments |

## Milestones / checkpoints

- Collection: `milestones` (listened in `DelivereeWorkspace.tsx` via `firestoreListenDiet` pack `milestones`).
- Created in workspace (~6346 `addDoc(collection(db, "milestones"), …)`): typically `projectId`, title/date/order/status.
- Checkpoints = Stage **Phase** list in `docs/certo-work-project-fields.md` (not a separate collection). Plan/Gantt also treats epic-derived checkpoints as delivery checkpoints (`docs/certo-work-pm-experience.md`).

## Invoices

- Collection: `invoice_documents` — type `InvoiceDocument` in `src/lib/invoiceDocuments.ts` (`shareToken`, `projectId`, `clientName`, `invoiceNumber`, `amount`, `currency`, `issueDate`, `dueDate`, `status`, `paymentStatus`, remittance/admin notes, `revoked`).
- Public route: `/invoice/<token>` → `PublicInvoicePortal.tsx` (token = doc id / `shareToken`).
- Billing module: `src/features/billing/BillingScreen.tsx` gated by `flags.billing` on user doc (separate from invoice_documents when flag on).

## Ticket / request tasks

- Conventions: `src/lib/captureRequests.ts` — `ticketStatus`, `customerStatus`, `requesterEmail`, `lastPublicUpdate`, `publicTicketProjection()`, `REQUEST_PORTAL_COLLECTION = "request_portal_tokens"`.
- Create/reply flows in `DelivereeWorkspace.tsx` (~5480–5844).
- Public route today: `/request/<token>` → `PublicRequestPortal.tsx` (prompt’s `/r/<token>` is an alias target for Step 18).

## Collab external / guests

- `src/lib/collab/guestService.ts` — `createExternalThread`: `conversations` type `external`, `guests/{guestId}` with `token`, `email`, `conversationIds`; portal path `/c/<token>`.
- Messages: `conversation_messages` with `visibility: 'external'` / guest `senderType` (see Collab rules + `server.ts` guest/portal message routes).
- Guest UI: `src/features/collab/GuestPortal.tsx`.

## Attachments / storage

- Project attachments live with notebook/docs and storage paths under project-scoped storage (notebook / docs tabs in `ProjectSurfaces` / Deliveree listeners). Portal projects only `clientFolder: true` attachments (additive flag).

## Contacts / stakeholders

- Project sponsors via `sponsorIds` / contacts pickers in `ProjectSurfaces.tsx`.
- Stakeholder/contact entities used for invite flows; portal maps primary contact → `portal_members`.

## Brevo email

- `worker/index.js` — `sendBrevoTransactionalEmail`, `sendInviteEmail`; `BREVO_API_KEY`, `CERTO_EMAIL_FROM`.
- `worker/inviteEmail.js` — `inviteEmailContent`.
- `worker/captureRequests.js` — request reply email via injected `sendBrevoTransactionalEmail`.
- Routines scheduler: `worker/routinesScheduler.js` (`maybeNotifyOwner` + `sendEmail`).

## Auth

- `src/lib/AuthContext.tsx` — Google / email+password; workspace membership via `workspace_members`; no email-link sign-in yet (portal adds `sendSignInLinkToEmail`).
- Custom claims: not set today; portal will set `{ portal: true, workspaceId, clientIds }`.

## Routines engine

- Recipes: `src/lib/routines/recipes.ts` (`ROUTINE_RECIPES`; existing `resumen-cliente` Friday draft).
- Types/collections: `src/lib/routines/types.ts` (`routine_runs`, `recipes`, `routine_sessions`).
- Storage/sessions: `src/lib/routines/storage.ts`, `sessions.ts`.
- Worker: `worker/routinesScheduler.js`.
- Collab recipes: `src/lib/collab/routines.ts`.

## Odysseus / scoped ask

- Team chat: `/api/boldi/chat` in `server.ts`; Collab scoped: `POST /api/collab/odysseus` (~309).
- Panel: `src/features/odysseus/panel`. Portal uses callable `portalAsk` with projected context only (never mounts Odysseus panel).

## Workspace branding

- `workspaces/{id}.name` (AuthContext `Workspace`); color/description; logo not a first-class field today — portal `PortalSettings.brand` + optional `logoUrl` on `clients` (assumption: fall back to workspace name / Certo mark).

## Existing public token surfaces

| Prompt path | Actual route | Component | Token store |
| --- | --- | --- | --- |
| `/status/<token>` | `/report/<token>` | `PublicStatusReport.tsx` | `project_status_shares` |
| `/invoice/<token>` | `/invoice/<token>` | `PublicInvoicePortal.tsx` | `invoice_documents.shareToken` |
| `/r/<token>` | `/request/<token>` | `PublicRequestPortal.tsx` | `request_portal_tokens` |
| `/c/<token>` | `/c/<token>` | `GuestPortal.tsx` | `guests.token` |
| forms | `/form/<token>` | `PublicTableForm.tsx` | table form tokens |

App entry: `src/App.tsx` (public tokens before auth shell; workspace mounts `DelivereeWorkspace`).

## Flags pattern

- Per-user: `users/{uid}.flags.<key>` (e.g. `dailyPlan`, `billing`, `collab`) — see `useDailyPlanEnabled.ts`, `BillingScreen`, `FeatureLabsPanel`.
- Typed env/tenant flags: `src/lib/featureFlags.ts` (no `clientPortal` yet).
- Portal: `flags.clientPortal` on **workspace** doc (team gate); per-project portal off until PM enables in Client portal tab.

## Rules / indexes / functions

- `firestore.rules` — `isWorkspaceMember` (~67); invoice/request portal token branches; no portal claims yet.
- `firestore.indexes.json` — includes `invoice_documents` group indexes.
- Cloud Functions package: `functions/` (calendar callables in `functions/src/index.ts`); new code under `functions/src/clientPortal/`.
- Shared app zod: root `package.json` has `zod`, `date-fns`; functions package needs `zod` added for projection `.strict()` parses.
