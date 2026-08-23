# 07 — Certo MCP

Read-only tools (Phase 6):

- `certo_search_projects`
- `certo_get_project`
- `certo_search_work_items`
- `certo_get_work_item`
- `certo_list_project_work`
- `certo_get_attention_summary`
- `certo_list_pending_approvals`

Authorization: `CertoMcpIdentity` (workspaceId, agentId, grants). Cross-tenant requests throw `CROSS_TENANT_DENIED`.

Evidence refs returned on every item for auditability.

Implementation: `src/lib/agent-platform/certoMcp.ts` + `worker/mcp/certoMcp.js`.
