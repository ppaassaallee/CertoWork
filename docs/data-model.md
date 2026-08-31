# Certo Work data model

Source of truth for Firestore collections used by Certo Work. `firestore.rules`, converters, and route schemas must match this document.

## Tenancy invariant

Every workspace-scoped document carries `workspaceId`. Server queries filter by it. Rules verify the caller is an active `workspace_members` doc (`${workspaceId}_${uid}`, `status == "active"`) or the workspace `ownerId`.

Do not trust `userId` / `workspaceId` from the client body on `/api/*`. Auth middleware stamps them from the verified Firebase token + membership.

## Identity and access

| Collection | Owner fields | Required keys | Notes / rules |
|---|---|---|---|
| `workspaces` | `ownerId` | `ownerId`, `name`, `createdAt` | Owner create/update/delete. Only the owner, an email in `members`, or an active `workspace_members` row may read — including the workspace name. Signed-in strangers must not list other companies' workspaces. |
| `workspace_members` | `workspaceId`, `userId` | `workspaceId`, `userId`, `role`, `status` | Doc id is `${workspaceId}_${uid}`. Roles: `owner`, `admin`, `member`, `viewer`. `portfolioViewer: true` grants workspace-wide project read. |
| `users` | `userId` (doc id) | auth uid | Signed-in user profile. |
| `access_requests` | `userId` | `email`, `status` | Beta access queue. |
| `invoice_documents` | `workspaceId`, `shareToken` (doc id) | `workspaceId`, `title`, `amount`, `status`, `paymentStatus` | AP invoice queue. Members list workspace invoices. Finance operators (admin/owner or `financeAccess`) update lifecycle. Client portal can get/update by token: paid, rejected, exception. Statuses: `billed`, `sent`, `pending_approval`, `approved`, `paid`, `rejected`, `void`, `exception`. |
| `feedback_reports` | `workspaceId`, `userId` | `workspaceId`, `kind`, `title`, `status` | Members create/read own. Admins read workspace queue and convert to `tasks` PBIs. Statuses: `submitted`, `triaged`, `converted`, `closed`, `wontfix`. Kinds: `bug`, `feature`. |

## Delivery OS (core)

Canonical health: `on_track` \| `at_risk` \| `blocked`. Canonical project statuses: `idea`, `planning`, `active`, `paused`, `completed`, `archived`. Delivery stages: `idea`, `assessment`, `approved`, `planning`, `delivery`, `uat`, `production`, `support`, `archived`. Dirty aliases (`done`/`completed`/`closed`) normalize at write time.

| Collection | Owner fields | Required keys | Status enums |
|---|---|---|---|
| `projects` | `workspaceId`, `userId` / `ownerId` | `workspaceId`, `title` or `name` | `status`, `health` / `healthOverride` |
| `tasks` | `workspaceId`, `userId` | `workspaceId`, `title` | `open`, `in_progress`, `blocked`, `done` (and aliases) |
| `milestones` | `workspaceId`, `projectId` | `workspaceId`, `projectId`, `title` | `open`, `done` |
| `risks` | `workspaceId`, `projectId` | `workspaceId`, `projectId`, `title` | `open`, `closed`, `resolved`, `accepted` |
| `sprints` | `workspaceId`, `projectId` | `workspaceId` | — |
| `review_candidates` | `workspaceId` | `workspaceId`, `status` | `pending`, `approved_for_review`, `approved`, `rejected` |
| `cost_templates` | `workspaceId` | `workspaceId` | — |
| `project_status_shares` | `workspaceId` | token + project snapshot | Public read via token |
| `categories` | `workspaceId` | `workspaceId`, `name` | Controlled lists |
| `stakeholders` | `workspaceId` | `workspaceId` | — |

Project read is allowed for owners, explicit `visibleToUserIds` / `visibleToEmails`, role assignees, workspace admins, or members with `portfolioViewer`.

## Conversations and approvals

| Collection | Owner fields | Retention default |
|---|---|---|
| `boldi_conversations` | `workspaceId`, `userId` | `RETENTION_CONVERSATIONS_DAYS` (365) |
| `boldi_messages` | `workspaceId`, conversation id | same |
| `boldi_action_plans` / `boldi_actions` | `workspaceId` | Audit on apply |
| `inbox_items` | `workspaceId` | Capture / audio: `RETENTION_AUDIO_DAYS` (90) |
| `notebook_entries` / `notebook_pages` | `workspaceId` | — |

Every AI-initiated mutation and every approval decision should write an audit record: `{ actorUid, actorType: user\|agent, action, entityRef, before, after, requestId, at }`.

## Personal modules (More)

Habits, workouts, daily metrics, and related collections are user+workspace scoped (`userId`, `workspaceId`). They are not Core Work.

## War room / agents

`war_room_*` and `agent_*` collections are currently signed-in readable in rules; they still must carry `workspaceId` for server queries. Tighten rules in a follow-up to membership checks.

## Indexes

Composite indexes live in `firestore.indexes.json`. Deploy with `firebase deploy --only firestore:indexes`.
