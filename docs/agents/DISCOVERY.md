# Agents Track B — Discovery

Recorded at the start of Track B (after Track A landed).

## How agents are listed today

| Surface | Source | Notes |
|---------|--------|-------|
| `AgentsLibrary.tsx` via `AgentsArea` | Primarily **War Room / Odysseus** UX + `boldi_agents` Firestore collection | Library UI documented in `docs/agent-platform/11-agent-ux.md` |
| Platform contracts | `src/lib/agent-platform/types.ts` — `AgentDefinition`, `AgentVersion`, `AgentTrigger`, `AgentRunRecord`, `AgentAction` | Product contracts exist; builder UI incomplete |
| War Room | Reads/writes `boldi_agents`, `agent_runs` | Legacy path still live |

## What creates `agent_runs`

| Path | Location |
|------|----------|
| War Room orchestrate | `server.ts` `/api/warroom/chat-orchestrate` + War Room client |
| Capture / Today | `Capture.tsx`, `Today.tsx` `addDoc(agent_runs)` |
| Hermes adapter | `src/lib/agent-platform/hermesAdapter.ts` + `hermesClient.ts` |
| Action execution | `actionExecutor.ts` + `policy.ts` |

## Schedules

- Collection: `scheduled_tasks` (Odysseus schedules UI + Setup settings)
- Routines: `src/lib/routines/schedule.ts` + `processTableEvent.ts` for table domain events
- No dedicated `AgentTrigger` scheduler wired to Hermes jobs yet → **B6**

## Hermes flag

- Client/env keys: `HERMES_BASE_URL` / `CERTO_HERMES_BASE_URL`, `CERTO_HERMES_API_KEY`
- Runtime field on `AgentDefinition.runtime`: `"hermes" | "legacy_odysseus"`
- Production: treat Hermes as **optional**; fallback = legacy Odysseus with the same `AgentRunRecord` shape (**assumption**)

## Skills / integrations

- Skills: `skills`, `skill_folders` collections (War Room / agent builder drafts)
- Connections: `integration_configs` shape used by Settings › Integrations
- Approvals lens: existing Approvals route; agent actions with `approval_required` to land there in **B7**

## Item event stream

- Table events: `processTableEvent` exists
- Task/item events: **no first-class `itemEvents` stream** found → create in **B6** written by item services
- Mentions: War Room `mentionsAgentIds`; Collab bridge maps `mentions.agentIds` (`warRoomBridge.ts`)

## Fallbacks locked for Track B

1. No item event stream → emit `itemEvents` in B6
2. Hermes off → execute via legacy Odysseus path, persist identical run records
3. `boldi_agents` → read adapter + migration script (dry-run default) in B2
4. Flag off → hide Track B product chrome; War Room keeps working
