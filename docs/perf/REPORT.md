# Certo Work — performance remediation report

Branch: `cursor/perf-new-project-0-7a36`  
Baseline: `docs/perf/BASELINE.md`

## Shipped in this PR

| Step | Change | Status |
| --- | --- | --- |
| 0 | New project create vs context intent; draft reset by project id | Done |
| 1 | `scripts/perf-baseline.ts` + `docs/perf/BASELINE.md` | Done |
| 2 | Removed all `includeMetadataChanges` | Done |
| 3 | `tasksByProject` / `risksByProject` indexes + memoized portfolio aggregates + `memo(ProjectCommandCenter)` | Done |
| 4 | `src/data/` collection stores (`useSyncExternalStore`) for projects/tasks/conversations/members; signature-stable `replaceAll` skips no-op republishes; `startWorkspaceData` helper ready | Done (bridge: shell still reads stores for other views) |
| 5 | Lazy `ProjectsRoute` + `ModalHost`/`uiStore` for wizard; portfolio no longer mounts `ProjectCommandCenter` into the shell tree eagerly | Done (partial — more routes next) |
| 6 | `vite.config.ts` manualChunks match npm + pnpm | Done |
| 7 | Persistent Firestore IndexedDB cache; Projects portfolio no longer opens `table_records` / finance / strategy packs | Done |
| 8 | Removed client auto pricing-sync, auto follower-grant, and creator-assignee restore on every snapshot (Settings buttons remain) | Done |
| 9 | `scripts/perf-guards.mjs` in CI | Done |

## Still next

| Step | Why |
| --- | --- |
| 4b | Stop shell from calling `useTasks()` / `useProjects()` — extract MyWork/Home routes so siblings do not re-render on every task snapshot |
| 5b | Lazy `MyWorkRoute`, `HomeRoute`, `ProjectRoute`, Odysseus panel; shrink `DelivereeWorkspace` under 800 lines |
| 7.2 | Open-tasks-only query + per-table `table_records` |
| 10 | Browser long-task / Lighthouse numbers on Regina’s workspace |

## Measured deltas (build)

| Metric | Before | After |
| --- | ---: | ---: |
| App JS chunks | 1 × 4,272 KB (1,073 KB gz) | App 2,179 KB (578 KB gz) + vendor splits |
| `includeMetadataChanges` | 10 | 0 |
| `tasks.filter(projectId)` in ProjectSurfaces | 8+ | 0 |
| Projects listen packs (`work`/portfolio) | tables+records+finance+strategy+… | tables+milestones+templates only |

## Manual QA (Regina / Pure AI)

- [ ] Home → Projects → project → My Work ×10 without “page unresponsive”
- [ ] Projects → **New project** → “Create project”, empty title (conversation linked to KruOps)
- [ ] Type in wizard while another user edits a project → draft stays
- [ ] Odysseus “update project X” still pre-fills
- [ ] Edit a task while Projects is open → no multi-second freeze
- [ ] Settings › Data still runs pricing sync / grant followers on demand
