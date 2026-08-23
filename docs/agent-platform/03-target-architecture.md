# 03 — Target architecture

```text
Certo Work UX (Prompt-1 Agents)
        │
Certo Control Plane (Worker + services)
  Agent Registry · Versions · Triggers · Policy · Approvals · ActionExecutor
        │
AgentRuntimeAdapter (HermesRuntimeAdapter)
        │
Certo Runtime Gateway (private)
        │  Cloudflare Tunnel / private path
Hermes (GCP Compute Engine + Docker + /opt/data)
        │
Certo MCP (read + propose)
        │
Firestore (system of record)
```

## Hard rules
- Browser never talks to Hermes
- Hermes never gets unrestricted Firestore credentials
- Business mutations only via ActionExecutor after policy/approval
- Model is not the authorization layer
