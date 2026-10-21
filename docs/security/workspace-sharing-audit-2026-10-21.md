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
- Workspace-scoped project/item queries and required composite indexes were added. The project feed retains closed items for the owner; for teammates it merges project-visible rows with their directly assigned private rows instead of letting either subscription erase the other.
- A local Firestore rules emulator exercised owner, member, viewer, invited email, and unrelated-workspace accounts for project, public/private item, milestone, document, invitation and role-escalation cases. It passed. The full repository test suite passed 893/893; TypeScript/Vite build passed; lint had zero errors (pre-existing warnings).

## Production blockers / remaining work

1. **Firebase Storage is not tenant-isolated.** `storage.rules` currently allow any authenticated account to read project documents and Collab attachments. The app uses a named Firestore database, while Storage rules can consult only the default Firestore database. A server-mediated upload/download path using Firebase Admin against the named database, plus migration/revocation of existing download tokens, is needed before claiming cross-workspace isolation for files. Do not merely deny all reads: that would break existing documents.
2. **Legacy item visibility needs an audited migration.** Historical project items were written with `visibility: private` by default. There is no reliable flag separating deliberate privacy from that former default. Do not bulk-change them to `project` without an owner review, because doing so could expose intentionally private data.
3. **Live verification is pending.** The local Firebase CLI credential is expired. Confirm the production rules/index deployment in CI and test with real invited member, project viewer, project assignee, removed member, and unrelated workspace accounts before release.
4. **Other surfaces remain to audit.** `access_requests` still has signed-in global list/update permissions, and long-lived Storage download URLs may outlive membership removal. Those must be addressed in a separate security change.

Do not present this branch as resolving all three user requirements until blockers 1–3 are complete.
