# Chatwoot removal inventory

Removed in Step 1 of the native Collab rebuild.

## Files deleted
- `src/components/ChatCollabModule.tsx` — iframe desk UI
- `src/components/ProductSwitcher.tsx` — Work / Chat Collab product tabs
- `src/lib/collabClient.ts` — SSO / desk / rooms client
- `src/lib/collabRooms.ts` — room partition helpers for Chatwoot Channels
- `src/lib/collabModule.ts` — replaced by `src/lib/collab/paths.ts` (path helpers only)
- `worker/collab.js` — Chatwoot proxy, SSO provision, HTML rewrite
- `ops/chatwoot/**` — GCP VM compose, bootstrap, deploy scripts, env examples
- `tests/collab-module.test.ts`
- `tests/collab-rooms.test.ts`

## Routes / Worker behavior removed
- `GET /api/collab/status` (Chatwoot status payload)
- `POST /api/collab/sso`
- `POST /api/collab/rooms`
- `isChatwootProxyPath` / `proxyChatwoot` for `/app`, `/auth`, `/cable`, `/packs`, `/platform/*`, etc.
- `isCertoCollabBrandPath` brand-asset rewrite for Chatwoot
- Integrations payload field `collab: collabStatusPayload(env)`

## Secrets / env vars removed
- `CHATWOOT_URL`
- `CHATWOOT_PLATFORM_TOKEN`
- `CHATWOOT_ACCOUNT_ID`
- Wrangler `vars` entries for Chatwoot
- `.env.example` Chatwoot block
- Wrangler `run_worker_first` Chatwoot path prefixes (`/app`, `/auth`, `/cable`, …, `/brand-assets`)

## CSS
- `.do-collab-*` Chatwoot-shell rules stripped; native Collab area styles land in later steps

## Kept
- Route `/collab` and helpers in `src/lib/collab/paths.ts`
- Lens `{ kind: "collab" }` in `delivereeRoutes`
- Header / command-palette entry to open `/collab` (now native CollabArea)
