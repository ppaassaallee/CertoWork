# Certo Work — powered by Boldr AI

Certo Work is a conversation-first personal operating system that preserves the existing COD, planning, projects, review, knowledge, health, and Boldr OS modules while adding an accountable Chief of Staff layer.

## Codex Sites deployment

Production is hosted by Codex Sites. The edge adapter in `worker/index.js`
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

1. Install dependencies with the package manager represented by the lockfile.
2. Copy `.env.example` to `.env.local`.
3. Configure Firebase and add `OPENAI_API_KEY`.
4. Run `npm run dev`.

`BOLDI_AI_PROVIDER=openai` is the production setting. The application remains
usable for capture and review when OpenAI is unavailable.

## Verification

- `npm test`
- `npm run build`
