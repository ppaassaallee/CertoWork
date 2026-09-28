# Client Portal — Assumptions

Fallbacks when a piece was missing or ambiguous during the continuous run.

1. **Mockup HTML** (`certo-client-portal.html`) was not available on the cloud runner filesystem; UI follows the prompt’s Client · Home / Client · Project / Team · Client portal tab descriptions plus Certo tokens in `src/styles/tokens.css`.
2. **Public status path** in-repo is `/report/<token>` (not `/status/`); Step 18 adds `/status/` as an alias that mounts the same bannered portal.
3. **Public request path** in-repo is `/request/<token>` (not `/r/`); Step 18 adds `/r/` alias.
4. **Workspace logo** is not a first-class Firestore field today; portal brand uses `PortalSettings.brand` / client `logoUrl`, falling back to workspace `name` + `CertoMark`.
5. **Billing invoices** collection is feature-flagged (`flags.billing`); projection prefers `invoice_documents` and merges Billing docs when the flag/collection is present.
6. **Checkpoints** are Stage/Phase values (and milestone docs), not a separate `checkpoints` collection.
7. **Attachment `clientFolder`** is an additive boolean on attachment/notebook metadata; when absent, documents are not projected.
8. **`flags.clientPortal`** lives on the workspace document (boolean); per-project enablement is `clients.portalEnabled` / project Client portal tab, independent of the workspace flag.
9. **Functions package** did not ship `zod`; it is added as a dependency for projection strict parses (or schemas are duplicated under `functions/src/clientPortal/schemas.ts` importing zod).
10. **Email-link auth** domain/action URL defaults to `{origin}/portal/auth`; Firebase console Authorized domains must include production host (noted in `DEPLOY.md`).
12. **Clients sidebar route** — `ClientsPages` ships for `/clients` and `/clients/:id`; DelivereeWorkspace nav group wiring is a follow-up if the path is not already handled by the catch-all workspace router.
13. **Nightly client_stats** — Insights UI reads `client_stats/{clientId}/days/{date}`; aggregator function is listed as a follow-up in REPORT.md.
