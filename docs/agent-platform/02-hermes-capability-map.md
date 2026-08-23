# 02 — Hermes capability map

**Reference clone:** `/tmp/hermes-agent-reference`  
**Commit:** `7a54ab2` (NousResearch/hermes-agent)  
**Pinned image (Certo):** `nousresearch/hermes-agent:latest` → pin digest at first successful staging

## Verified capabilities (current source)

| Capability | Mechanism | Notes |
| --- | --- | --- |
| API server | OpenAI-compatible `:8642` | `API_SERVER_ENABLED`, `API_SERVER_KEY` required |
| Chat | `POST /v1/chat/completions` | SSE + `hermes.tool.progress` |
| Responses | `POST /v1/responses` | Server-side conversation state |
| Persistence | `/opt/data` ← `~/.hermes` | Profiles, sessions, skills, cron |
| Profiles | `HERMES_HOME` / profiles tree | State isolation ≠ OS tenant sandbox |
| MCP | Hermes MCP client | Connect Certo MCP as external server |
| Cron/Jobs | Built-in scheduler | Natural language + jobs |
| Approvals | Command / memory / skills write gates | Runtime approvals ≠ Certo business approvals |
| Docker | Official compose | Prefer bind `127.0.0.1` only |
| Security | Do not expose API publicly | Certo Runtime Gateway fronts Hermes |

## Profile ≠ security sandbox
Hermes profiles isolate agent state/config. They do **not** provide multi-tenant OS isolation. SaaS scale requires one runtime per workspace trust boundary.

## Differences from earlier assumptions
- Primary public surface is OpenAI-compatible Chat/Responses, not a separate proprietary Runs REST exclusively.
- Certo normalizes Hermes streams into `AgentRunEvent` product events.
- Gateway default binds localhost; Certo never exposes raw Hermes ports.
