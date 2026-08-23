# 08 — Action policy

Deterministic defaults in `src/lib/agent-platform/policy.ts`.

| Action class | Decision |
| --- | --- |
| Reads / analyze / reports | allow |
| create_task / update_* / communications | ask |
| manage_members / secrets / financial | deny |

Approved actions execute via Certo ActionExecutor — never by the model directly.
Idempotency keys prevent duplicate side effects.
