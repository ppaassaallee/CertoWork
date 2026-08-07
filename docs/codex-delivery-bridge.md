# DelivereeOS ↔ Codex delivery bridge

## Outcome

DelivereeOS remains the source of truth for projects, work items, conversations, and knowledge. Codex receives only the project context and executable work items selected in a project console. Codex can claim work, report progress or blockers, and return completion evidence. DelivereeOS applies only the changes permitted by the handoff and records delivery evidence in Knowledge.

This is an explicit, auditable integration. It does not scrape a Codex chat, fabricate GitHub or CI/CD activity, or maintain a second task system.

## End-to-end workflow

1. Open a project console and choose **Codex**.
2. Record the repository folder or URL.
3. Select the PBIs, stories, tasks, bugs, or subtasks Codex may claim.
4. Choose automatic delivery sync or review-every-change.
5. Create the handoff and copy its launch brief.
6. Start a new Codex task with the DelivereeOS Bridge plugin and paste the brief.
7. Codex loads the scoped context, links the task, and claims selected work before editing.
8. Codex reports real progress, tests, acceptance evidence, files, commits, PRs, and deployments only when they exist.
9. DelivereeOS updates the canonical task record and writes a delivery-evidence Knowledge document.
10. New scope and project gaps always return for review.

## Data ownership

| Concern | Authoritative store | Notes |
| --- | --- | --- |
| Projects and hierarchy | Existing Firestore project/task collections | Additive canonical fields preserve current IDs and routes. |
| Connection settings | Existing `integration_configs` collection | Workspace/user/project scoped; no new Firestore rules required. |
| Delivery audit | Existing `delivery_reviews` collection | Records the applied Codex event and evidence. |
| Knowledge | Existing `knowledge_items` collection | Completion and gap records are project-linked. |
| MCP transport | Sites D1 binding | Holds authenticated scoped snapshots, runs, and pending events only. |

## Permission contract

- Every browser request requires a verified Firebase identity.
- Every Codex MCP request requires the signed-in ChatGPT/Codex identity.
- The bridge binds the ChatGPT identity, Firebase user, workspace, project, and connection.
- Planning containers are context only; Codex can claim only explicitly selected executable items.
- Automatic mode covers progress, completion, tests, and knowledge evidence for selected items.
- Review mode keeps every update pending.
- New scope, destructive changes, and cross-project changes are never automatically authorized.
- Disconnect disables the link in both Firestore and the MCP transport.

## Jira/Azure Boards core gap matrix

| Capability | Current decision |
| --- | --- |
| Canonical work-item hierarchy | Implemented additively on the existing task collection: Epic → Feature → executable item → Subtask. |
| Work-item types and statuses | Implemented in the project console, including nullable priority and generated project keys. |
| Project backlog | Existing console reused and expanded; full drag-and-drop and saved filters remain deferred. |
| Board / flow | Existing project Flow view reused; configurable workflows remain deferred. |
| Sprint planning and ceremonies | Existing Plan surface reused; first-class sprint records and ceremony workflows remain a separate increment. |
| Knowledge linking | Implemented for Codex delivery evidence and gaps. Broader document-to-sprint/release linking remains deferred. |
| Conversational changes | Existing approval/action-plan path reused; the Codex bridge adds scoped engineering updates. |
| GitHub readiness | Real URLs/evidence can be returned by Codex. A GitHub App, webhooks, and repository synchronization are not claimed or simulated. |
| CI/CD readiness | Real build/deployment evidence can be recorded. Pipeline ingestion is deferred until a provider is connected. |
| Hermes Harness readiness | No live connection is claimed. Provider-specific integration remains deferred. |
| Reports and releases | Existing project summary reused. First-class release and sprint analytics remain deferred. |
| Audit and security | Implemented for the bridge with account/workspace/project binding and applied-event records. |

## Validation

- TypeScript production build passes.
- ESLint passes.
- All automated tests pass, including authenticated MCP access, anonymous rejection, work selection, launch contract, completion mapping, and evidence preservation.
- The plugin is versioned in `integrations/codex-plugin` and can be installed in Codex.

## Operational limitation

Authorized events remain safely queued in D1 until the project Codex tab is opened. The current release intentionally uses this pull-and-apply model instead of pretending a background Firebase service account exists. A future trusted backend can apply events continuously without changing the MCP contract.
