# 15 — Production runbook

## Deploy Certo app

```bash
git checkout main && git pull
npm run deploy:cloudflare
```

## Preferred: enable Hermes via Hermes Cloud + Portal

Follow **`16-hermes-cloud-setup.md`**.

1. Create Portal subscription + Hermes Cloud instance.
2. Verify `curl $HERMES_BASE_URL/v1/models` with the instance API key.
3. Set Worker secrets:

```bash
npx wrangler secret put CERTO_HERMES_RUNTIME   # 1
npx wrangler secret put HERMES_BASE_URL        # https://… (no /v1)
npx wrangler secret put API_SERVER_KEY         # instance key
npm run deploy:cloudflare
```

## Optional fallback: self-host Hermes staging

```bash
cd infra/hermes/terraform/environments/staging
terraform init && terraform apply
# then SSH/IAP: mount disk, docker compose up, cloudflared
```

Then set the same Worker secrets pointing at the tunnel/gateway URL that speaks OpenAI `/v1` (or Hermes directly with `API_SERVER_KEY`).

## Rollback

```bash
npx wrangler secret put CERTO_HERMES_RUNTIME
# 0
```

Legacy `runOdysseusAgent` resumes.
