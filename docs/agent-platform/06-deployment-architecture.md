# 06 — Deployment architecture

## Recommended (personal): Hermes Cloud + Nous Portal

See **`16-hermes-cloud-setup.md`**.

```text
Certo Worker → Hermes Cloud HTTPS (/v1/chat/completions + API_SERVER_KEY)
                 └─ models/tools via Nous Portal (inside the instance)
```

No GCE, Docker, Tunnel, or Runtime Gateway required.

## Local (dev / self-host lab)

`infra/hermes/docker/docker-compose.dev.yml`
- Hermes `nousresearch/hermes-agent:latest` on `127.0.0.1:8642`
- Runtime Gateway on `127.0.0.1:8787`
- Volume `certo_hermes_data` → `/opt/data`
- Set `API_SERVER_HOST=0.0.0.0` inside the container so the gateway can reach Hermes on the Docker network; keep host publish on `127.0.0.1`.

## Staging / production self-host (optional fallback)

`infra/hermes/terraform/`
- GCE `e2-medium` (or `e2-small` for cheap personal)
- Persistent disk for Hermes state
- Dedicated SA (no broad Firestore by default)
- No public Hermes ports — Cloudflare Tunnel to Runtime Gateway

```text
Certo Worker → Runtime Gateway (service token) → Hermes :8642 (API_SERVER_KEY)
```

Prefer Hermes Cloud unless you need full control or Cloud lacks an OpenAI-compatible API URL.

## Blockers (self-host)

GCP apply + Cloudflare tunnel token not available in the cloud agent environment.
