# Certo Run initial data

Exported November 3, 2026 from Alejandro's reorganized backlog (425 items, 136 projects, 3 workspaces). English titles and fields; proper nouns, amounts and dates unchanged.

| File | Rows | What |
|---|---|---|
| workspaces.json | 3 | pure-ai (shared, teal), boldr-ai (shared, amber), personal (private, violet), with the client list per workspace |
| projects.json / .csv | 136 | one row per epic: workspace, client, lane, pipeline stage (commercial only), counts per decision, features, team names, next due date |
| items.json / .csv | 425 | one row per item with external_id, workspace, lane, decision, priority, epic, feature, title, context, deliverable, done_when, next_step, source, owner, due_date, client_entity, tags, queue_order, created |

Expected counts after import: Pure AI 264 open items, Boldr AI 153, Personal 7. One item carries `needs_world_review: true` (it was "to confirm" in the source) and is placed in pure-ai with the tag `needs-world-review`.

Owner names are free text. The importer sets `assigneeName` always and `assigneeUid` only when an instance member has the same display name. Pipeline stages come from the feature names Discovery, Proposal and pricing, Negotiation and contract, Closing and kickoff. Health is empty: set it from the Delivery view after import.

Idempotent: re-running the import matches on `external_id` inside the workspace and updates instead of duplicating.
