# Agents Track B — QA

## Verified (automated)

| Check | Result |
|-------|--------|
| Template provisioning creates definition + version | PASS (`agents-jobs-track.test.ts`) |
| Builder save + Publish bumps version / status | PASS |
| Test run shows plan without executing | PASS (`buildTestRunPlan`) |
| Assign agent → run + activity step label | PASS |
| `@Agent` mention parsing | PASS |
| Domain event → one run; cooldown; loop guard | PASS |
| Schedule binds Hermes XOR routines | PASS |
| Reach denies project outside dataAccess | PASS |
| System templates (≥9) seeded | PASS |

## Manual / flag matrix

- `VITE_AGENTS_JOBS_ENABLED=0` hides builder, templates, usage, chips, agent assignee group; War Room / Odysseus unchanged.
- Hermes on (`CERTO_HERMES_RUNTIME=1`): schedule mode `hermes`; off: `routines`.
- Approvals: `AgentAction` with `approval_required` surface via existing Approvals lens + builder “Waiting for you” (execute path uses `actionExecutor.ts`).
- Track A parity: re-run `npx tsx scripts/parity-snapshot.ts --compare … --allow-additions` after Track B (additions only).

## Mobile (B10)

- Builder path on phone → `AgentsMobileContinueCard` (“continue on desktop”).
- Agents list + approvals remain available in the phone shell via existing Approvals / Agents routes.

## Assumptions

See `docs/clean-ui/ASSUMPTIONS.md` and Track B discovery fallbacks in `docs/agents/DISCOVERY.md`.
