# Certo Work real production hosting

## Decision

`certo.work` must not point to ChatGPT Sites for the real product experience.
ChatGPT Sites is useful for previewing versions, but it adds the ChatGPT access
screen before the app. A normal user-facing product URL should be served by an
owned host.

The recommended production target for the current codebase is Cloudflare
Workers Static Assets:

- the frontend already builds to `dist/client`;
- `worker/index.js` is already a Worker-style edge runtime;
- the app already expects `/api/*`, `/__/auth/*`, and `/mcp/*` to be served from
  the same origin;
- Cloudflare can serve the SPA and route API requests through the Worker without
  introducing a second backend.

## What changes

| Area | ChatGPT Sites preview | Cloudflare production |
| --- | --- | --- |
| User entry | ChatGPT access gate | Direct app load at `https://certo.work` |
| Static app | Sites asset hosting | Workers Static Assets from `dist/client` |
| API | Sites Worker adapter | Cloudflare Worker from `worker/index.js` |
| Secrets | Sites environment | Cloudflare Worker secrets |
| DNS | ChatGPT custom domain | Cloudflare custom domain / DNS |
| Firebase auth | Must authorize Sites/custom domain | Must authorize `certo.work` and `www.certo.work` |

## Deployment commands

Run once per Cloudflare account/session:

```bash
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
```

Deploy from a logged-in machine:

```bash
npm run deploy:cloudflare
```

Or deploy from GitHub Actions. Create an API token with **Account → Workers
Scripts → Edit** (not Workers AI) and **Zone → Workers Routes → Edit**, then
add these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Pushes to `main` and manual **Deploy Cloudflare** workflow runs build the
SPA and run `wrangler deploy`. That deploy keeps the `certo.work` custom
domain from `wrangler.jsonc`. Worker runtime secrets such as
`OPENAI_API_KEY` stay in the Cloudflare dashboard; they are not GitHub
secrets.

Dry-run validation:

```bash
npm run deploy:cloudflare:dry
```

## DNS cutover

Do not remove the working ChatGPT Sites domain until the Cloudflare deployment
has been tested on its generated `workers.dev` URL.

Recommended cutover:

1. Deploy to Cloudflare (`npm run deploy:cloudflare` or GitHub Actions).
2. Test the `*.workers.dev` URL if you need a preview hostname.
3. Keep `certo.work` as the Worker custom domain in `wrangler.jsonc`. Add
   `www.certo.work` in the dashboard if you also serve www.
4. In GoDaddy, either:
   - move nameservers to Cloudflare, then manage DNS in Cloudflare; or
   - keep GoDaddy DNS and add the exact records Cloudflare requests.
5. In Firebase Authentication, add authorized domains:
   - `certo.work`
   - `www.certo.work`
   - the generated Cloudflare preview domain.
6. Test:
   - app loads without ChatGPT gate;
   - Google sign-in returns to `certo.work`;
   - `/api/capabilities` returns JSON;
   - `/api/boldi/chat` returns either an AI response or a clear configured
     offline-safe message.

## Required Cloudflare variables

Configured as `vars` in `wrangler.jsonc`:

- `BOLDI_AI_PROVIDER=openai`
- `OPENAI_MODEL`
- `FIREBASE_PROJECT_ID=gen-lang-client-0277783597`

Configured as secrets:

- `OPENAI_API_KEY`

## Rollback

If the Cloudflare deployment has an issue, point DNS back to the previous
ChatGPT Sites custom domain until the Worker is fixed. The application data
model does not change as part of this hosting move.
