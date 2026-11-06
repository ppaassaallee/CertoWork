# Private Grok delegation

This change permits an explicitly delegated assistant to act on the designated
owner's Run items. It does **not** enable Certo Run for another person.

## Configure securely after deployment

1. Sign in as the verified Run owner. Open Settings → API tokens.
2. Name the token `Grok Run`, enable the private Run delegation checkbox,
   and select only the intended work workspaces.
3. Map each selected workspace explicitly to Pure AI or Boldr AI. Each world
   may appear once. Personal is not available through this delegation.
4. Create the token. Copy its one-time value directly to Grok's secret named
   `CERTO_MCP_TOKEN`. Never paste it into a prompt, repository, log or screenshot.
5. Connect Grok to `https://certo.work/mcp` with `Authorization: Bearer <secret>`.
6. Call `get_readiness` for each workspace, then `get_caps` and `list_queue`.
   Test `create_item` with `dry_run:true` before enabling actual writes.

Tokens remain revocable and expiring. Existing tokens are not upgraded.
The backend verifies the caller's signed Firebase email verification claim at
issuance, workspace membership at each call, and owner/world on each item.

## Delivered tool coverage

- `list_workspaces`: selected workspaces only.
- `get_readiness`: reports supported and unavailable capabilities honestly.
- `list_queue`: owner + workspace + world isolation; compact, paginated output.
- `get_caps`: current queue/P1/admin counts using existing Run domain rules.
- `create_item`: source external ID required; retry-safe, private PBI creation.
- `update_item`: limited Run field updates; completion requires an evidence ID.
- `add_comment`: bounded comment append, attributed to the delegated assistant.
- `search`: owner Run items plus owned legacy matches, including closed items for
  deduplication. Legacy matches are flagged and cannot be silently recreated.
- `list_fields`: Run vocabulary and existing owner Run labels, not catalog admin.
- `propose_decision` / `list_proposals`: source-backed, retry-safe proposals;
  only the verified human owner can review through the separate UI endpoint.
- `record_brief` / `get_brief`: persisted morning/midday editions, shown on Today.
- `record_sync_state` / `get_sync_state`: bounded cursor/log, with revision checks
  preventing simultaneous runs from overwriting one another.

Create/update/comment use a Firestore read-write transaction. Item and audit
entry commit together; conflicting commits retry. Caps are checked against the
transaction's complete workspace snapshot. A workspace over 2,000 records fails
closed rather than calculating caps from truncated results. Agent concurrency
tests do not certify global caps for concurrent legacy UI writers.

## Readiness contract and deliberate limits

`get_readiness` now probes the delegated scope, complete item snapshot and control
storage. It returns `contract: certo-run-sync/1`, `profile: core_sync`, concrete
checks and `scopes: [read, write, propose]`. Readiness is no longer a constant.
It can return ready for this core sync workflow; this does not mean the entire
original operating brief, every source connector or the full 14-Run-tool suite
is complete. `full_operating_brief_ready` remains false and unsupported tools
are enumerated. Never pretend these tools exist or activate source schedules
merely because core MCP readiness passed.

The 07:00/12:00 executor and source connectors belong to **Grok**, not a duplicate
Certo cron. Certo does not verify those external connections or activate them.
An end-to-end source-backed dry run and manual real run must pass before Grok's
operator resumes its schedules. Log unavailable sources rather than guessing.

Review UI: Run → Queue → Decide. Supported proposal actions: retitle,
set_priority, drop, mark_done, renegotiate, move_to_make, delegate. Approve/reject
is owner-Firebase-authenticated, never a callable MCP tool. Target fingerprint
and caps are rechecked in the same transaction as the item/proposal/audit commit.
A stale proposal cannot overwrite a newer change. Proposal defer leaves it
pending. Existing item titles and priorities still cannot be changed directly
by an agent. Source references are supplied evidence, not independently fetched
or verified by Certo.

Owner-only `/api/run/agent/snapshot` resolves each world's actual workspace from
active delegations. It no longer displays Boldr against the active Pure AI
workspace. Conflicting world mappings fail closed. Briefs, proposals and sync
state share a bounded `run_agent_state` record scoped by owner/workspace/world;
direct client Firestore access remains deny-by-default. The UI reads on demand,
on world change and after mutations, with an explicit Refresh control.

Existing delegated tokens do not need replacement to use these additional Run
tools. Ordinary MCP tokens still cannot access Run. No delete/admin scope or
Personal-world delegation was added. Legacy enrichment and advanced allocation,
pipeline, week-plan and life tools remain unsupported; do not recreate legacy
matches or claim those parts have been delivered.

No token has been issued or installed in Grok by this code change. No source data
has been imported and no scheduled job has been activated. The separate known
legacy Firestore Run-read ACL limitation remains unchanged by this change.

## Cost boundaries

No new service, background listener, cron or model invocation. Readiness and
queue/cap calls read on demand. Item/proposal approvals use a complete workspace
snapshot up to the explicit limit. Brief and sync writes read only their single
control document, not the workspace. Retention is bounded (28 brief editions,
100 pending proposals, 50 reviewed proposals, 14 sync logs, 2,000 processed IDs,
240 KB serialized control state). A scoped indexed Run query or counter ledger
is still needed before high-volume unattended ingestion; do not call this a
completed infrastructure cost optimization.

## Core sync tool examples (no secrets)

Before writes, call `get_sync_state`, `search` and `get_caps`. Use `dry_run:true`
then the same validated call without dry-run. A failed cap write must become a
proposal, not a forced retry. Proposals require `external_id`, `item_id`, action,
reason and `evidence_source_id`; retitle/priority/date/delegate also require value.
Briefs require `date` (YYYY-MM-DD), `kind` (morning/midday), `body` and nonempty
`source_ids`. `record_sync_state` requires `expected_revision` from the previous
read, `state` with world/last_run_at/last_run_kind/processed/aliases/open_questions,
and `log` with summary/failed_sources. Persist cursor state only after successful
writes. On stale_sync, reread; on uncertain write outcome, search stable IDs or
read back the proposal/brief before retrying. Do not transmit source credentials.

Transaction contract checked against Google Cloud's official REST references:
[beginTransaction](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/beginTransaction)
and [runQuery](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/runQuery).

Validation for the core workflow: 990 unit tests, two real-panel browser tests
(English/Spanish, approve payload, stale failure retained, mobile width),
TypeScript/build, ESLint quiet, debt budget, Worker deployment dry-run. Browser
tests use intercepted synthetic fixtures; no source data or customer records are
created in production by these tests. Run them with `npm run test:run-workflow`.
