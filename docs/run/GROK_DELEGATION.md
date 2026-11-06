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

Create/update/comment use a Firestore read-write transaction. Item and audit
entry commit together; conflicting commits retry. Caps are checked against the
transaction's complete workspace snapshot. A workspace over 2,000 records fails
closed rather than calculating caps from truncated results. Agent concurrency
tests do not certify global caps for concurrent legacy UI writers.

## Not delivered / do not enable unattended sync yet

`get_readiness.ready` remains **false**. This token does not implement the full
14-tool operating brief, proposal approval lifecycle, brief persistence, source
connections, or the 07:00 / 12:00 schedules. Proposal/reorder/delete/admin tools
are not advertised or callable. Existing titles and priority changes are refused
pending a genuine proposal lifecycle; there is no assistant self-approval path.

No token has been issued or installed in Grok by this code change. No source data
has been imported and no scheduled job has been activated. The separate known
legacy Firestore Run-read ACL limitation remains unchanged by this change.

## Cost boundaries

No new service, background listener, cron or model invocation. Readiness does not
scan tasks. Queue/cap calls read on demand; mutations currently read the workspace
snapshot for correctness, up to the explicit limit. A scoped indexed Run query or
counter ledger is needed before high-volume unattended ingestion; do not call
this a completed cost optimization.

Transaction contract checked against Google Cloud's official REST references:
[beginTransaction](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/beginTransaction)
and [runQuery](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/runQuery).
