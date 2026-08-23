# 12 — Security model

- Browser never receives Hermes credentials
- Hermes never gets unrestricted Firestore admin
- MCP grants are least privilege
- Profile ≠ tenant isolation
- Imported schedules default disabled (when import lands)
- Terminal off by default
- Cross-tenant MCP denied
- Secrets in Secret Manager / Cloudflare secrets only
