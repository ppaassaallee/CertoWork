# Persistent Certo MCP connection in Grok Bot

## Incident: 2026-11-08

The existing `CERTO_MCP_TOKEN` was still available to Lucy's diagnostic process,
but Certo was absent from Grok Bot's installed connections. A saved environment
secret alone is not a registered MCP connection. Direct authenticated diagnostic
reads returned 15 tools and core readiness in both delegated worlds. That is
not evidence of a persistent registration or a successful persisted write.

The first Python-client request was rejected by Cloudflare (403/1010). Do not
change client identifiers, spoof a browser, switch origins, disable TLS checking
or retry around such a denial. Review the owner-controlled security policy if
the supported client is blocked. The adapter below stops on 401/403/redirects;
it never retries or sets a custom User-Agent.

## Why stdio

Grok Bot's exposed AddMcpServer schema supports `name`, `command`, `args`, `env`
as well as remote URL/static headers. Its remote static-header interface did
not expose a protected binding to the existing runtime secret. Putting the token
in a model-visible tool argument, header configuration or chat is not acceptable.

`scripts/certo-mcp-stdio.mjs` is a dependency-free, Certo-only adapter. The native
stdio subprocess reads `CERTO_MCP_TOKEN` from its approved runtime environment
and sends JSON-RPC to the fixed `https://certo.work/mcp` destination. The token
does not appear in config, command-line arguments, URLs or logs. No secrets are
searched for, copied to a file or recovered from transcripts. The remote Certo
server still enforces owner/workspace/world permissions and caps.

The adapter supports Certo's JSON and finite SSE responses, notifications and
negotiated protocol/session headers. It does not open a public listening port,
create a service, run schedules, import work or invoke an LLM. Calls are serialized
and have a 30-second timeout. It is not a general-purpose MCP gateway or a
replacement for the provider's credential manager.

## Setup (no credential values)

1. Obtain the adapter from an explicitly verified commit of this repository and
   keep it in the Bot's persistent workspace. Use Node 20 or later.
2. Register through Grok Bot's supported AddMcpServer command/stdio flow:

   ```json
   {
     "name": "Certo Run",
     "command": "node",
     "args": ["/absolute/path/to/certo-mcp-stdio.mjs"],
     "env": {}
   }
   ```

3. The registered subprocess **must** receive the existing `CERTO_MCP_TOKEN`
   through the provider's approved runtime secret injection. This is a real
   precondition, not an assumed feature. If it does not inherit that environment,
   initialization fails with `missing_credential` and makes no network request.
   Do not invent `${...}` interpolation or put the secret into the JSON above.
   Resolve injection through a supported secure mechanism or request provider
   support. A connection that appears Installed but cannot initialize is not fixed.
4. User approval is required for the account-wide connection. It is available
   to that account's Bots, not other users. Keep the existing read/write/propose
   delegation; do not add delete/admin or Personal.
5. Verify Installed, then invoke **the registered connection**, not a standalone
   HTTP script: initialize, tools/list, list_workspaces, get_readiness and
   get_sync_state in each delegated world. Re-test in a fresh message/session.
6. Test a valid write with `dry_run:true` first. A persisted verification write
   or first source import requires user authorization; report read-only and
   write evidence separately. Do not resume schedules just because reads pass.

On 403/1010 stop and report the HTTP status and CF-Ray without credentials.
On missing_credential stop and identify the missing runtime binding. Never rotate
the token or weaken site security merely to make a health check turn green.

## References and tests

- [Grok Bot: computer and apps](https://docs.x.ai/grok-bot/computer-and-apps)
  documents command-based MCP servers, account-wide connections and shared runtime.
- [MCP transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
  defines newline-delimited stdio and Streamable HTTP.
- [Cloudflare 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/)
  explains the browser-signature denial; review policy rather than bypassing it.
- `tests/mcpStdioBridge.test.ts` uses injected transports and synthetic credentials;
  it never sends a real token or touches production records.
