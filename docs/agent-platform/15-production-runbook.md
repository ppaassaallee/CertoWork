# 15 — Production runbook

## Deploy Certo app
```bash
git checkout main && git pull
npm run deploy:cloudflare
```

## Deploy Hermes staging
```bash
cd infra/hermes/terraform/environments/staging
terraform init && terraform apply
# then SSH/IAP: mount disk, docker compose up, cloudflared
```

## Enable Hermes Odysseus
Set Worker secret `CERTO_HERMES_RUNTIME=1` + `HERMES_BASE_URL` + `API_SERVER_KEY` after shadow validation.

## Rollback
Unset `CERTO_HERMES_RUNTIME` — legacy `runOdysseusAgent` resumes.
