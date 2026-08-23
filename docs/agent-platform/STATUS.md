# Agent platform — STATUS

**Current phase:** 7–11 (vertical slice implemented; GCP staging blocked on credentials)

## Completed
- Phase 0 baseline (tests 159 pass, build green; Prompt-1 IA preserved)
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

## In progress
- Real GCP staging deploy (blocked)
- Live Hermes container smoke (needs Docker + API key locally)

## Files changed
See PR diff: `docs/agent-platform/*`, `infra/hermes/*`, `runtime-gateway/*`, `src/lib/agent-platform/*`, `src/components/agents/*`, `worker/mcp/*`, `worker/runtime/*`, Firestore rules/indexes, tests.

## Tests run
```bash
npm test
npm run build
```

## Known failures
- None introduced in unit suite.

## External blockers
- `CLOUDFLARE_API_TOKEN` (certo.work deploy)
- GCP credentials / project access (staging VM apply)
- `OPENAI_API_KEY` or Hermes portal key for live Hermes runs
- Docker daemon may be unavailable in cloud agent VM

## Next executable step
1. `docker compose -f infra/hermes/docker/docker-compose.dev.yml up -d`
2. Set `API_SERVER_KEY` + model keys
3. `cd runtime-gateway && npm start`
4. Apply Terraform staging when GCP SA available
5. Set Worker secret `CERTO_HERMES_RUNTIME=1` after shadow validation

## Production status
**DEPLOYMENT READY — blocked on specific credentials** (GCP + Cloudflare + Hermes API key)
