# Assistant access

Certo Work can expose a user's work items to their own executive assistant. The API is **off** until the owner turns it on. Nothing in this change is deployed by merging the pull request.

## Flags

| Flag | Where | Default |
|---|---|---|
| `ASSISTANT_ACCESS_ENABLED` | Express server and Cloudflare worker | off |
| `VITE_ASSISTANT_ACCESS` | Settings UI | off |

Both must be `1` (or `true` / `on` / `yes`) before a token can be created or used. With the flags unset, `/api/assistant/*` returns `404 assistant_access_disabled` and the settings screen is unchanged.

Do not set `ASSISTANT_ACCESS_ENABLED` in `wrangler.jsonc`. Add it as a Worker secret or var only when the owner decides to enable it. Do not commit tokens, service accounts, or workspace exports.

## What a token can see

A personal access token belongs to one user and to the workspaces named when it was created.

- The secret is shown once. Only its SHA-256 hash is stored, plus a short prefix for the settings list.
- Scopes: `items:read` (always), `items:propose` (opt-in), `items:write` (opt-in, direct mutation).
- Every call checks that the workspace is on the token **and** that the user is still the owner or an active member. Leaving a workspace cuts the token off. A token for workspace A cannot read workspace B.
- Each accepted call writes an audit row in `assistant_audit_events` (actor, token id, workspace, action, time). The secret is not logged.
- Tokens expire (default 90 days, maximum 365) and can be revoked from Settings → Preferences when the UI flag is on.

New collections, all denied to the client by the existing default Firestore rule:

- `assistant_access_tokens`
- `assistant_proposals`
- `assistant_audit_events`

Firestore rules were not changed.

## Read API

`Authorization: Bearer cw_pat_…`

`GET /api/assistant/items?workspaceId={id}&updated_since={iso}&cursor={cursor}&limit={1-100}`

`GET /api/assistant/items/{id}?workspaceId={id}`

Each item includes stable `id`, `external_ref`, `kind` (`epic`, `feature`, `pbi`, …), `parent_id`, `epic_id`, `feature_id`, `project_id`, `status`, `priority`, `due_date`, `assignee`, `attributes.delivery_entity`, `attributes.client_entity`, `tags` (`id` + `name`), `description`, `created_at`, `updated_at`.

`updated_since` is exclusive. Pages are ordered by update time, then id. `next_cursor` is omitted when the page is the last one. A workspace read loads at most 2000 tasks and then pages in memory, so this stays compatible without a new composite index.

## Proposal queue

`POST /api/assistant/proposals` with `items:propose` does **not** change tasks. It stores a pending proposal for that user.

```json
{
  "workspaceId": "…",
  "action": "create",
  "item_id": "required except for create",
  "fields": { "title": "…", "priority": 1, "external_ref": "optional" }
}
```

Actions: `create`, `update`, `close` (sets `status` to `done`), `reprioritize`.

The user reviews them in **Proposed by assistant** (same settings panel) or via:

- `GET /api/assistant/proposals?workspaceId={id}` with a Firebase ID token (not the personal access token)
- `POST /api/assistant/proposals/decide` with `{ workspaceId, decisions: [{ id, decision: "approve" | "reject" }] }`

Only the token owner can approve. Approval writes the allow-listed fields and `assistantAttribution` (`proposalId`, `tokenId`, `assistantLabel`, `approvedByUserId`, `appliedAt`). `createdAt` is stored as a Firestore timestamp so the existing task rules still allow the owner to edit the item. Rejecting writes nothing to `tasks`.

Limit: 30 proposals per token per hour (`429 rate_limited`).

`POST /api/assistant/items` requires `items:write` and mutates immediately. Leave that scope off unless the owner wants it. Prefer proposals.

## Remote MCP

`POST /api/assistant/mcp` with the same bearer token. JSON-RPC methods: `initialize`, `tools/list`, `tools/call`.

Tools: `list_items`, `get_item`, `propose_item`. They use the same checks as the JSON API. `propose_item` only queues.

## Token management

Firebase ID token (the signed-in user), not a personal access token:

- `GET /api/assistant/tokens`
- `POST /api/assistant/tokens` `{ label, workspaceIds, scopes, expiresInDays }` → `{ token, access_token }`. Copy `token` immediately.
- `POST /api/assistant/tokens/{id}/revoke`

A user cannot create a token for a workspace they do not belong to, list another user's tokens, or revoke another user's token.

## Migration

None. No backfill, no rewrite of existing tasks, no rules deploy. Existing items gain `external_ref` or `assistantAttribution` only when a proposal is approved or an `items:write` token creates an item.

## Tag and dialog fixes

These are on without the assistant flags. They do not delete documents or change rules.

**Tags.** Home and My Work never subscribed to `categories`, so tag ids survived on the task but rendered as "Unresolved tag" after reload. Creating a tag while that list was empty also inserted another category document with the same name, which is why the controlled list filled with duplicates. Categories now load for the signed-in user on every workspace screen (this workspace, plus legacy rows with no `workspaceId`). The settings list and pickers show one chip per name. Raw Firestore ids are not added as discovered tag names. Turning a tag off also clears duplicate ids that share that name. Duplicate category documents are left in Firestore.

**Dialog.** The open lookup used only the filtered view, so a rename that dropped the row from that view left the selection with nothing to show. The dialog now falls back to the full item pool. Title edits commit on blur; opening immediately after a rename could lose the click when the list re-rendered. Open buttons cancel that blur on mouse down. Optimistic title and tag edits are applied even when `updatedAt` has not changed yet, and a failed save restores the task from the store snapshot (including on Home and project, where the shell task array is empty).

### Risk and rollback

- Extra category listener on every signed-in screen. It reads the user's own categories only. Rollback: remove the `categories` `onSnapshot` effect and restore `makeQueryLocal("categories", …)` inside the templates pack.
- Deduping is display and toggle behavior. It does not merge or delete category documents. Rollback: revert `controlledOptions`, `dedupeTagsByName`, and `toggleTagWithCatalog`.
- `applyStoreUpdate` now upserts changed rows instead of relying on `replaceAll` for functional updates. Listener snapshots still use `replaceAll`. Rollback: restore the previous `applyStoreUpdate` body.
- Dialog mouse-down handling only calls `preventDefault` so the title field does not blur before the click. Rollback: remove `retainFocusForOpen`.

## Owner decisions still open

1. When to set `ASSISTANT_ACCESS_ENABLED` and `VITE_ASSISTANT_ACCESS`. Until then the API is dark.
2. Whether any token should receive `items:write`. The default request in the settings panel leaves it unchecked. Proposals are the safer path.
3. Workspace-shared tag catalogs. Category reads are still `userId == auth.uid` in `firestore.rules`. A tag created by a teammate can still show as unresolved for someone else. Fixing that needs a rules change and was not made.
4. Duplicate category documents already stored. The UI hides them. A cleanup script would be a separate, explicit migration.
5. Workspaces with more than 2000 tasks need a paged Firestore query and a composite index (`workspaceId` + `updatedAt`). Not added, to avoid an index deploy.
6. Members whose `workspace_members.status` is `accepted` but not `active` are denied, matching the existing API membership check.
