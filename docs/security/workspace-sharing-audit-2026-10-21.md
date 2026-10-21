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

## Production blockers / remaining work

1. **Firebase Storage is not tenant-isolated.** `storage.rules` currently allow any authenticated account to read project documents and Collab attachments. The app uses a named Firestore database, while Storage rules can consult only the default Firestore database. A server-mediated upload/download path using Firebase Admin against the named database, plus migration/revocation of existing download tokens, is needed before claiming cross-workspace isolation for files. Do not merely deny all reads: that would break existing documents.
2. **Legacy item visibility needs an audited migration.** Historical project items were written with `visibility: private` by default. There is no reliable flag separating deliberate privacy from that former default. Do not bulk-change them to `project` without an owner review, because doing so could expose intentionally private data.
3. **Live verification is pending.** The local Firebase CLI credential is expired. Confirm the production rules/index deployment in CI and test with real invited member, project viewer, project assignee, removed member, and unrelated workspace accounts before release.
4. **Other surfaces remain to audit.** `access_requests` still has signed-in global list/update permissions, and long-lived Storage download URLs may outlive membership removal. The portal signed-link endpoint has been narrowed, but these broader paths must still be addressed before a tenant-isolation claim.

## File-access completion plan

1. Add authenticated callable endpoints for a short-lived upload policy (with size and content-type constraints) and a short-lived download URL. Use `getCertoFirestore()` (the named database) to confirm active membership, project access, and item/document visibility for **every** request; use random object IDs under the workspace path.
2. Change Project Docs and Collab attachments to persist object paths instead of long-lived Firebase download URLs. Request a fresh signed URL only when uploading or opening an attachment. Do not expose a permanent download token in Firestore records.
3. Inventory existing objects and references. Migrate in batches, rotate/remove `firebaseStorageDownloadTokens`, and confirm previously shared links stop working. Preserve recovery copies and log exceptions before cutting over.
4. Only after both UIs use the endpoints, change `storage.rules` to deny direct client reads/writes for those prefixes. Test current member, removed member, project assignee, private-item nonparticipant, and unrelated workspace against both new and migrated files.
5. Deploy function + UI first, validate on staging, then deploy the Storage rule lock and repeat the same checks in production. Firebase budget/usage should be monitored because signed-link issuance adds server calls.

Do not present this branch as resolving all three user requirements until blockers 1–3 are complete.
