# 09 — Trigger model

Types: `manual | schedule | domain_event | webhook | integration_event`.

Schedule mapping: Certo `AgentTrigger` → Hermes Job (`hermesJobId`).

Loop prevention: `traceId`, `correlationId`, `causationId`, chain depth, cooldown.

`scheduled_tasks` reused during migration; only one scheduler executes a logical automation (feature flag).
