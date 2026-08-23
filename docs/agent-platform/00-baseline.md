# Phase 0 — Baseline after Prompt 1

**Date:** 2026-08-23  
**Branch base:** `main` @ `92ed818` (IA refactor #14 merged)

## Preserved Prompt-1 invariants
- Primary nav: Home / My Work / Projects / Agents / Approvals
- No More menu, no Command Center as product noun
- Odysseus under Agents, not parallel hire-card universe
- Recent conversations ≤5

## Baseline commands
| Command | Result |
| --- | --- |
| `npm test` | 159 pass / 0 fail |
| `npm run build` | success |
| Cloudflare deploy | not authenticated in this environment |
| GCP | no credentials |

## Pre-existing notes
- War Room module exists but is unmounted
- `/api/boldi/chat` remains compatibility endpoint
- Odysseus custom loop in `worker/odiseus-agent.js` still primary until Hermes flag
