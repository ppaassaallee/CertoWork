# Workspace sharing and tenant isolation audit — 2026-10-21

Status: code changes validated locally; **not a production certification or deployment**.

## Confirmed defects

- Project and item rules accepted direct ID/email grants even after a user no longer belonged to the record's workspace.
- Project work items were created `private` by default, so project teammates could not see them. The item detail view had no explicit privacy control.
- A newly assigned item could grant access to the item without granting the assignee access to its project context.
- Any signed-in user could alter their own `workspace_members` role/finance fields; `agent_invites` were broadly readable and writable.
- The login invite lookup queries by email. Restricting that rule to only `invited` records breaks re-entry for already-accepted members.
- Legacy milestones permitted any signed-in user with an email to list records, regardless of workspace.

## Changes and local evidence

- Project and item reads now require active membership (or workspace ownership) before direct grants apply. Project-visible items inherit project read access; explicit private items remain limited to direct participants.
- Project item creation defaults to project visibility; a bilingual item-menu control switches between project and private visibility. The main creation/update path adds assignees and collaborators to the project team atomically with the item write.
- Workspace membership and invite writes are role-bound; invited email acceptance is restricted to the matching account. Workspace, project and task tenant IDs cannot be changed by updates.
- Member removal and invitation revocation now commit the membership status, workspace email/role list, and invite status together. A partial failure can no longer leave an apparently removed address eligible to rejoin.
- Creating an invitation also commits the workspace email/role list, pending member, and invitation token together before attempting email delivery. Delivery failures still expose the copyable invite link, but do not leave a half-created invitation.
- Workspace-scoped project/item queries and required composite indexes were added. The project feed retains closed items for the owner; for teammates it merges project-visible rows with their directly assigned private rows instead of letting either subscription erase the other.
- A local Firestore rules emulator exercised owner, member, viewer, invited email, and unrelated-workspace accounts for project, public/private item, milestone, document, invitation and role-escalation cases. It passed. The full repository test suite passed 893/893; TypeScript/Vite build passed; lint had zero errors (pre-existing warnings).
- The client portal's document-download callable no longer accepts an arbitrary `storagePath` from the caller. It rechecks the active portal membership, client/project publication, source document, and that the object path belongs to that exact workspace and project. The source-path checks are covered by tests; the full repository suite now passes 896/896 and the Functions TypeScript build passes.
- Project Docs now has a staged server-mediated path in this branch: authenticated, project-authorized five-minute signed upload policies (50 MB limit), object paths instead of new permanent Firebase download URLs, and fresh ten-minute signed download links that recheck current membership. Legacy Firebase URLs are parsed only for the configured bucket and the same project's object prefix. The manual Functions workflow now includes the portal-document and Project Docs endpoints; Cloudflare's SPA workflow alone would not deploy them. This code is **not deployed**. Local validation: 900/900 tests, frontend and Functions builds, lint with zero errors.

## Production blockers / remaining work

1. **Firebase Storage is not tenant-isolated in production.** Production rules allow any authenticated account to read project documents and Collab attachments. The app uses a named Firestore database, while Storage rules can consult only the default Firestore database. This branch denies the dormant Collab Storage prefix; that rule has **not** been deployed. The new Project Docs path cannot be released until the bucket is configured and tested for browser signed POST uploads; the live bucket currently reports CORS **Not enabled**. A read-only inspection of one existing Project Docs object confirmed a `firebaseStorageDownloadTokens` metadata entry; existing tokens need an object inventory and revocation. Do not merely deny all Project Docs reads: that would break existing documents.
2. **Legacy item visibility needs an audited migration.** Historical project items were written with `visibility: private` by default. There is no reliable flag separating deliberate privacy from that former default. Do not bulk-change them to `project` without an owner review, because doing so could expose intentionally private data.
3. **Live verification is pending.** The local Firebase CLI credential is expired. Confirm the production rules/index deployment in CI and test with real invited member, project viewer, project assignee, removed member, and unrelated workspace accounts before release.
4. **Other surfaces remain to audit.** `access_requests` still has signed-in global list/update permissions, and long-lived Storage download URLs may outlive membership removal. The portal signed-link endpoint has been narrowed, but these broader paths must still be addressed before a tenant-isolation claim.

## File-access completion plan

1. Apply the narrow `docs/security/storage-cors.json` to the bucket and verify one browser upload on a non-production project. Confirm runtime service-account signing permission for Cloud Functions. The code for signed Project Docs upload/download is already in the draft branch.
2. Run the read-only `node scripts/audit-project-docs.mjs` with project-scoped Google application credentials to count objects, old tokens, missing references, and out-of-prefix records without logging customer filenames or token values. Local execution currently cannot run because this machine has no Application Default Credentials. Verify all currently linked documents still open through `getProjectFileUrl`. If any source is outside `project-docs/{workspaceId}/{projectId}/`, migrate it explicitly rather than signing it by exception.
3. Deploy the Functions and UI together and validate signed upload/open with an owner and a project teammate. Keep the old Storage rule only for the brief compatibility window, not as the final state.
4. Remove `firebaseStorageDownloadTokens` from legacy objects in audited batches (preserve recovery metadata), then deny direct client reads/writes to `project-docs` in `storage.rules`. Deploy the already-written Collab deny rule at that same Storage rules cutover; do not re-enable its old helper without an equivalent server-mediated flow.
5. Test current member, removed member, project assignee, private-item nonparticipant, and unrelated workspace against new and migrated files. Repeat in production and monitor Firebase usage because signed-link issuance adds server calls.

Do not present this branch as resolving all three user requirements until blockers 1–3 are complete.
