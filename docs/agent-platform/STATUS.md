# Agent platform — STATUS

**Current phase:** Hermes Cloud + Portal path documented (preferred); self-host remains fallback

## Completed
- Phase 0 baseline (tests pass, build green; Prompt-1 IA preserved)
- Phase 1 Certo + Hermes audits (docs)
- Phase 2 target contracts / data model / runtime contract
- Phase 3 local Hermes Docker Compose (pinned image + gateway)
- Phase 4 Terraform scaffold for GCE + disk + SA (not applied)
- Phase 5 Runtime Gateway + HermesRuntimeAdapter
- Phase 6 Certo MCP read-only tools + tenant isolation tests
- Phase 7 smoke path via adapter (mock/local)
- Phase 8 Odysseus → Hermes behind `CERTO_HERMES_RUNTIME` flag (compat `/api/boldi/chat`)
- Phase 9 Action policy + ActionExecutor (deterministic)
- Phase 10 Trigger model + schedule mapping types
- Phase 11 Agents UX under Prompt-1 `/agents` destination
- Phase 12–16 docs (security, ops, DR, migration)
- **Hermes Cloud + Nous Portal personal runbook** (`16-hermes-cloud-setup.md`)

## In progress
- Live Hermes Cloud attach (needs Portal instance API URL + key from user)
- certo.work secrets + deploy (needs Wrangler auth on deploy machine)

## Deferred / optional
- GCP staging apply (blocked on credentials; not required if Cloud works)
- Local Docker Hermes smoke

## Next executable step (you)
1. Portal subscription + create Hermes Cloud instance
2. Confirm HTTPS `/v1/models` with instance API key
3. `wrangler secret put` `CERTO_HERMES_RUNTIME=1`, `HERMES_BASE_URL`, `API_SERVER_KEY`
4. `npm run deploy:cloudflare`
5. Agents → Odysseus smoke on certo.work

## Production status
**READY TO ATTACH** — blocked only on Hermes Cloud API URL/key + Cloudflare deploy secrets
