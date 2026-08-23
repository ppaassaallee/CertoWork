# 05 — Runtime contract

## Normalized run states
`queued | provisioning | starting | running | waiting_for_input | waiting_for_business_approval | waiting_for_runtime_approval | stopping | completed | failed | cancelled | unknown`

## Adapter
`AgentRuntimeAdapter` → `HermesRuntimeAdapter` using Hermes OpenAI-compatible API:
- `POST /v1/chat/completions` (+ stream)
- `POST /v1/responses` when available
- Auth: `Authorization: Bearer ${API_SERVER_KEY}`

## Gateway
External path: `/runtime/agents/:agentId/runs`  
Internal: `http://127.0.0.1:8642/v1/...`

## Events (normalized)
`run.started`, `thinking.started`, `tool.started|progress|completed`, `message.delta|completed`, `approval.requested`, `artifact.produced`, `run.completed|failed|cancelled`
