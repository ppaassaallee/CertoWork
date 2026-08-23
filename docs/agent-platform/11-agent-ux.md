# 11 — Agent UX

Under Prompt-1 `/agents`:

- **Bordered agent list** (not floating cards): status badge (semaforo), right-side metric, meaningful icon
- Odysseus metric prefers amber **pending approvals** (links to Approvals) else **runs today**
- Platform section removed — Automations + Activity are footer links
- Activity lines: verb + actor + result + relative time (`agentId`, `actionCount`, `result`, `createdAt`)
- Single page CTA: **New agent**
- Breadcrumb on library home: `Agents` only (not `Agents > Odysseus`)
- Display name from `ODISEUS_NAME` (`src/lib/odiseus.ts`)

Files: `src/components/agents/AgentsLibrary.tsx`, `src/lib/agentActivity.ts`, `src/lib/odiseusActivity.ts`
