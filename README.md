# Certo Work — powered by Boldr AI

Certo Work is a conversation-first personal operating system that preserves the existing COD, planning, projects, review, knowledge, health, and Boldr OS modules while adding an accountable Odysseus layer.

## Production hosting

`certo.work` should be served from an owned production host, not from ChatGPT
Sites. The repo includes `wrangler.jsonc` so the same Vite application and
Cloudflare-compatible Worker API can run on Cloudflare Workers Static Assets.

Use ChatGPT Sites only as a preview/demo environment. If `certo.work` points to
ChatGPT Sites, visitors will see the “Continue with ChatGPT” access gate before
the app. For a real product URL, deploy to Cloudflare and point DNS there.

Cloudflare production deploy:

1. Configure Worker secrets:
   - `npx wrangler secret put OPENAI_API_KEY`
2. Build and deploy from a machine with Wrangler auth:
   - `npm run deploy:cloudflare`
3. Or deploy from GitHub Actions: add repository secrets
   `CLOUDFLARE_API_TOKEN` (Workers Edit) and `CLOUDFLARE_ACCOUNT_ID`,
   then push to `main` or run **Deploy Cloudflare**.
4. After `workers.dev` looks good, attach custom domains in the Worker
   settings (do this in the dashboard so deploy still works before the
   zone is on the account):
   - `certo.work`
   - `www.certo.work`
5. Add these domains to Firebase Authentication authorized domains:
   - `certo.work`
   - `www.certo.work`
   - the generated `*.workers.dev` preview hostname, if used

See [docs/REAL_PRODUCTION_HOSTING.md](docs/REAL_PRODUCTION_HOSTING.md) for the
full cutover plan.

## ChatGPT Sites preview

The preview environment can be hosted by Codex Sites. The edge adapter in `worker/index.js`
serves the Vite application, preserves client-side routes, and keeps
`/api/boldi/chat` compatible. Google AI Studio is disabled in this runtime;
OpenAI is the only AI provider, with deterministic offline-safe behavior when
`OPENAI_API_KEY` is not configured.

Existing Firebase authentication, Firestore data, route names, and document IDs
remain unchanged. The legacy Express server stays available for local
compatibility while server capabilities move behind the edge adapter.

## What changed

- `/boldi` is the primary conversational home and `/` redirects there.
- Existing application routes and Firestore document IDs remain unchanged.
- Deterministic judgment runs before the model for commitments and planning requests.
- Actions are proposed as typed artifacts, require approval, and are staged to the existing review queue rather than executed invisibly.
- OpenAI Responses API and legacy Gemini providers are routed through compatible adapters.
- Offline requests are captured locally and synchronized to the existing inbox when connectivity returns.
- Feature flags resolve in environment → tenant → workspace → user precedence.

See [docs/CAPABILITY_LEDGER.md](docs/CAPABILITY_LEDGER.md) for the preservation ledger and [docs/MVP_ARCHITECTURE.md](docs/MVP_ARCHITECTURE.md) for the implementation boundaries.

## Local development

1. Copy `.env.example` to `.env.local` and fill Firebase Admin, `OPENAI_API_KEY`, `CORS_ORIGIN`, and `HUBSPOT_WEBHOOK_SECRET`.
2. `npm install`
3. `npm run dev` — Express + Vite on `PORT` (default 3000)
4. Optional: Firebase emulators for rules tests

`BOLDI_AI_PROVIDER=openai` is the production setting. The application remains
usable for capture and review when OpenAI is unavailable.

Every `/api/*` route except `/api/health` and `/api/capabilities` requires a Firebase Bearer token and an active workspace membership. Unsigned HubSpot webhooks are rejected.

## Verification

- `npm run lint`
- `npx tsc -b`
- `npm test`
- `npm run build`

See [docs/data-model.md](docs/data-model.md) for collections and tenancy, and [docs/runbooks/restore.md](docs/runbooks/restore.md) for Firestore backup/restore.
