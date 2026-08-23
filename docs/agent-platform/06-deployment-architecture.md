# 06 — Deployment architecture

## Local
`infra/hermes/docker/docker-compose.dev.yml`
- Hermes `nousresearch/hermes-agent:latest` on `127.0.0.1:8642`
- Runtime Gateway on `127.0.0.1:8787`
- Volume `certo_hermes_data` → `/opt/data`

## Staging / production (Terraform)
`infra/hermes/terraform/`
- GCE `e2-medium`
- Persistent disk 40GB for Hermes state
- Dedicated SA (no broad Firestore by default)
- No public Hermes ports — Cloudflare Tunnel to Runtime Gateway

## Connectivity
```text
Certo Worker → Runtime Gateway (service token) → Hermes :8642 (API_SERVER_KEY)
```

## Blockers
GCP apply + Cloudflare tunnel token not available in this agent environment.
