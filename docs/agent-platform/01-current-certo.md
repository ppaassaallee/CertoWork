# 01 — Current Certo agent systems

See full audit captured 2026-08-23.

## Summary recommendations

| System | Decision |
| --- | --- |
| Odysseus | KEEP product; MIGRATE runtime → Hermes |
| Boldi | DEPRECATE brand; KEEP `boldi_*` collections short-term |
| agentContracts | EVOLVE → capability registry |
| Skills | KEEP; MIGRATE invoke → Hermes Skills |
| scheduled_tasks | EVOLVE → AgentTrigger + Hermes Jobs |
| review_candidates | KEEP approval authority |
| odiseus_runs/activity/memory | MIGRATE runs/activity; KEEP memory semantics |
| War Room | DEPRECATE primary UX; selective MIGRATE |
| Action plans | EVOLVE unify into AgentAction → Approvals |

## Key collections
`odiseus_runs`, `odiseus_activity`, `odiseus_memory`, `scheduled_tasks`, `skills`, `review_candidates`, `boldi_conversations`, `boldi_messages`, `boldi_action_plans`, `agent_runs` (legacy dual rules).

## Compatibility
`POST /api/boldi/chat` remains the browser endpoint (strangler).
