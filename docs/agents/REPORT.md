# Agents — Track B Report

## Steps

| Step | Deliverable | Status |
|------|-------------|--------|
| B1 | `docs/agents/DISCOVERY.md` | Done |
| B2 | Unified model + `boldiAdapter` + migration script | Done |
| B3 | Agent builder (`/agents/new`, `/agents/:id/setup`) + `agentStore` | Done |
| B4 | System templates + gallery (`/agents/templates`) | Done |
| B5 | Assign / mention / activity chips on board cards | Done |
| B6 | `itemEvents` + trigger match + schedule bridge | Done |
| B7 | Reach helpers + approvals surface (existing lens) | Done |
| B8 | `/agents/usage` | Done |
| B9 | Agents library panel nav (Track A kit) | Done |
| B10 | Mobile continue-on-desktop for builder | Done |
| B11 | `docs/agents/QA.md` | Done |
| B12 | This report | Done |

## Flags

- `VITE_AGENTS_JOBS_ENABLED` — product chrome (default on in dev)
- `CERTO_HERMES_RUNTIME` — schedule/runtime backend selection

## Migration

- `boldi_agents` → definition/version via adapter; War Room unchanged
- `scripts/migrateBoldiAgents.ts` dry-run default

## Assumptions / follow-ups

- Firestore writes skipped in Node tests (`memoryOnly`); browser persists to `agent_*` collections when rules allow.
- Item services should call `emitItemEvent` on create/update/state change (hooked for mentions/assign; broader emit can expand from WorkItemsCenter status updates).
- Live Playwright parity + Lighthouse left as Follow-up from Track A ASSUMPTIONS.
