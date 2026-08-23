# 16 — Hermes Cloud + Nous Portal (recommended personal path)

**Preferred over self-host GCE** for personal Certo Work: less ops, no VM, no Docker, no Cloudflare Tunnel.

Hermes Cloud is in **preview**. Portal subscription covers models + Tool Gateway; Cloud hosts the Hermes runtime.

## Target shape

```text
Certo Worker (certo.work)
  → HTTPS OpenAI-compatible Hermes API (Hermes Cloud instance)
  → models + tools via Nous Portal (inside that instance)
```

Browser never talks to Hermes. No Runtime Gateway / Tunnel required for this path.

Certo still owns Firestore + Certo MCP. Hermes Cloud owns agent runtime, memory, schedules, channels.

## Part 1 — Nous Portal

1. Open [portal.nousresearch.com](https://portal.nousresearch.com) and sign in.
2. Subscribe / manage plan: [manage-subscription](https://portal.nousresearch.com/manage-subscription).
3. Confirm Portal covers the models and Tool Gateway you want (web, image, TTS, browser).

You do **not** need a separate OpenAI/Gemini key for Hermes if Portal is the provider on the Cloud instance.

## Part 2 — Hermes Cloud instance

1. Open [Hermes Cloud](https://portal.nousresearch.com/cloud) (or Portal → Agents / Cloud).
2. Create one instance, e.g. name `certo-odysseus`.
3. Pick a **frontier agentic** model (Claude Sonnet / GPT / Gemini Flash–class).  
   Avoid Hermes-4 chat models for agent loops (Nous guidance).
4. Wait until status is **running**.
5. From the instance detail page, copy:
   - **API base URL** (OpenAI-compatible host; often ends before `/v1`)
   - **API key** / bearer for the API server

### Gate (must pass before Certo secrets)

From your laptop:

```bash
export HERMES_BASE_URL="https://PEGAR_HOST_SIN_SLASH_FINAL"
export API_SERVER_KEY="pegar-api-key"

# If the UI gave .../v1, strip /v1 for Certo (Worker appends /v1/...)
curl -sS "$HERMES_BASE_URL/v1/models" \
  -H "Authorization: Bearer $API_SERVER_KEY"
```

Expect a JSON model list (or at least HTTP 200).  
If the UI only shows chat/Telegram and **no** HTTPS API URL, stop and ask Nous/Discord — Certo cannot attach without `/v1/chat/completions`.

Optional chat smoke:

```bash
curl -sS "$HERMES_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"ping"}],"stream":false}'
```

## Part 3 — Wire Certo Worker

On the machine that deploys `certo.work` (local, with Wrangler auth):

```bash
cd CertoWork
git checkout main && git pull

npx wrangler secret put CERTO_HERMES_RUNTIME
# value: 1

npx wrangler secret put HERMES_BASE_URL
# value: https://your-hermes-cloud-host   (no trailing /v1)

npx wrangler secret put API_SERVER_KEY
# value: same key that passed curl above

npm run deploy:cloudflare
```

Optional alias if you prefer a Hermes-named secret (Worker already accepts it):

```bash
npx wrangler secret put HERMES_API_SERVER_KEY
# same value as API_SERVER_KEY
```

Do **not** set `CERTO_RUNTIME_GATEWAY_*` for this path. Gateway is for self-host only.

## Part 4 — Test in Certo

1. Open https://certo.work → hard refresh.
2. **Agents → Odysseus**.
3. Ask: `Give me a short summary of my workspace.`
4. If Hermes is reachable, the Worker uses `tryHermesChat`; otherwise it falls back / errors per flag path.

Rollback anytime:

```bash
npx wrangler secret put CERTO_HERMES_RUNTIME
# value: 0
# then redeploy if needed
```

Legacy `runOdysseusAgent` resumes.

## What you skip (on purpose)

- Google Compute Engine / Oracle / Kubernetes / Cloud Run
- Docker on a VM
- Cloudflare Tunnel to `:8642` / `:8787`
- Self-host Runtime Gateway
- Separate OpenAI key (if Portal is the instance provider)

## Cost mindset

- Portal subscription: models + Tool Gateway
- Hermes Cloud: hosted runtime (preview pricing; scale-to-zero when idle per Nous marketing)
- Certo Worker / Firestore: unchanged

Check live numbers in Portal billing / Cloud FAQ — do not assume GCE `$18/mo`.

## If API URL is missing

1. Prefer Discord / support@nousresearch.com (Cloud is preview).
2. Interim: keep `CERTO_HERMES_RUNTIME=0` and use Certo legacy Odysseus.
3. Last resort only: self-host GCE path in `06-deployment-architecture.md` + `15-production-runbook.md`.

## Stuck: `Auth provider 'nous' unreachable`

This means the Cloud **host** is reachable, but the instance cannot verify/use **Nous Portal** auth. Do **not** set Certo Worker secrets until chat returns real assistant JSON.

### Recovery checklist (do in order)

1. **Portal account**
   - Sign in at https://portal.nousresearch.com
   - Open https://portal.nousresearch.com/manage-subscription
   - Confirm plan is active and credits > 0

2. **Open the Cloud instance UI (not local Hermes)**
   - https://portal.nousresearch.com/cloud
   - Open `certo-team-agent` (or your instance)
   - Status must be **Running** (not Stopped / Starting / Error)

3. **Chat inside Cloud UI first**
   - Send: `Say hello`
   - If UI chat also fails → skip to step 6 (platform issue)
   - If UI chat works → continue (API key / endpoint issue)

4. **Restart the instance**
   - Stop → wait until Stopped → Start → wait until Running
   - Retry Cloud UI chat once

5. **Fresh API credentials**
   - In the instance panel, find API / Keys
   - Regenerate or copy a new API key
   - Copy base URL **without** trailing `/v1`
   - Test:

```bash
export HERMES_BASE_URL="https://YOUR_HOST"
export API_SERVER_KEY="YOUR_NEW_KEY"

curl -sS -i "$HERMES_BASE_URL/v1/models" \
  -H "Authorization: Bearer $API_SERVER_KEY"

curl -sS -i "$HERMES_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"ping"}],"stream":false}'
```

   Success = HTTP 200 and a `choices` / assistant message.  
   Still `Auth provider 'nous' unreachable` = step 6.

6. **Nous support (Cloud is preview)**
   - Discord Nous Research, or support@nousresearch.com
   - Include: instance name, region/size, exact error JSON, that UI and/or `/v1/chat/completions` fail

7. **Unblock Certo meanwhile**
   - Leave `CERTO_HERMES_RUNTIME` unset or `0`
   - Use legacy Odysseus on certo.work
   - Revisit Cloud when curl succeeds

### Common mistakes

- Using **local** Hermes Keys OAuth as if it fixed Cloud (it does not)
- Pasting `HERMES_BASE_URL` with `/v1` (Worker adds `/v1/...`; strip it)
- Wiring Wrangler secrets before curl succeeds
- Assuming `claude-opus-*` is available; use `hermes-agent` or the model chosen at instance create until auth works

## Related

- Runtime contract: `05-runtime-contract.md`
- Security: browser never gets Hermes secrets — `12-security-model.md`
- Self-host fallback: `06-deployment-architecture.md`
