# Chatwoot host for Certo Work

Chat Collab is public on **certo.work only**. This stack is the private origin
the Cloudflare Worker proxies. Do not create `collab.certo.work`.

`FRONTEND_URL` is always `https://certo.work`.

## What you log into

Google Cloud login stays with you. This recipe uses Firebase project
`gen-lang-client-0277783597`.

## Deploy from Cloud Shell

1. Open [Cloud Shell on that project](https://shell.cloud.google.com/?project=gen-lang-client-0277783597) as `alejandro@getboldr.ai`.
2. Confirm billing is linked if Compute Engine is not already enabled.
3. Get these files onto the shell (clone the branch, or upload `ops/chatwoot`):

```bash
bash ops/chatwoot/deploy-gcp.sh
```

The script creates VM `certo-chatwoot` (`e2-standard-2`, `us-central1-a`),
opens TCP 3000, starts Postgres + Redis + Rails + Sidekiq, then prints:

- `CHATWOOT_URL` (`http://<vm-ip>:3000`)
- `CHATWOOT_ACCOUNT_ID`
- `CHATWOOT_PLATFORM_TOKEN`

4. Put those three values on the certo.work Worker (`npx wrangler secret put …`).
   Then deploy the Worker. `/collab` stays on certo.work.

## After it is up

Certo Work project → Chatwoot room (`Room · {project name}`). Super Admin is
`alejandro@getboldr.ai`. SSO provisions workspace members as administrators.
