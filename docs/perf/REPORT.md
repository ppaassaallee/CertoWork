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
| 6 | `vite.config.ts` manualChunks match npm + pnpm | Done |
| 7 | Persistent Firestore IndexedDB cache; Projects portfolio no longer opens `table_records` / finance / strategy packs | Done |
| 8 | Removed client auto pricing-sync, auto follower-grant, and creator-assignee restore on every snapshot (Settings buttons remain) | Done |

## Deferred (next PRs)

| Step | Why deferred |
| --- | --- |
| 4 | `useSyncExternalStore` collection stores — large structural move; shell still owns listeners |
| 5 | Split `DelivereeWorkspace` into lazy routes — depends on Step 4 for clean prop surfaces |
| 7.2 (partial) | Open-tasks-only query + per-table `table_records` still need composite indexes + store layer |
| 9 | CI Playwright long-task gate + eslint `onSnapshot` confine — add after Step 4 |
| 10 | Browser long-task / Lighthouse numbers on Regina’s workspace — needs DevTools or Playwright against a live session |

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
