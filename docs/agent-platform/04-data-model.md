# 04 — Data model

## New / evolved collections (additive)

| Collection | Owner | Purpose |
| --- | --- | --- |
| `agent_definitions` | server+owner | Persistent Agent identity |
| `agent_versions` | server | Immutable published config |
| `agent_runtime_bindings` | server | Hermes profile mapping (no secrets) |
| `runtime_instances` | server | Hermes VM/runtime metadata |
| `agent_triggers` | owner+server | Manual/schedule/domain triggers |
| `agent_actions` | server | Proposed/executed business actions |
| `event_outbox` | server | Domain event outbox |
| `agent_audit_log` | server | Redacted audit |

## Reused
`odiseus_runs` / `odiseus_activity` / `odiseus_memory`, `scheduled_tasks`, `skills`, `review_candidates`, `boldi_*` chat.

## Identity mapping
```text
Certo Agent id  →  AgentRuntimeBinding.hermesProfile = cw-a-<opaque>
```
