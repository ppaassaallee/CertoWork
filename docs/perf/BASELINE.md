# Certo Work — performance baseline

Generated: `2026-09-28T21:57:04.420Z` (static + build). Runtime long-task /
React.Profiler / onSnapshot burst counts need a browser session — fill those
rows after a local interactive run on Regina’s Pure AI workspace.

## Budgets (target by Step 8)

| Metric | Budget |
| --- | ---: |
| Long task after load | ≤ 200 ms |
| Long tasks in first 15 s (`/work/projects`) | ≤ 10 |
| `DelivereeWorkspace` commits per snapshot burst | ≤ 5 |
| Initial route JS (gzip) | ≤ 600 KB |
| Component file size | ≤ 1500 lines |
| `includeMetadataChanges` listeners | 0 |

## Pre-remediation (Step 1, before Steps 2–6)

Captured from `main` @ `02d4b5d` after a clean `npm run build` in this agent:

| Metric | Value |
| --- | ---: |
| `DelivereeWorkspace.tsx` lines | 11,217 |
| `ProjectSurfaces.tsx` lines | 7,528 |
| `WorkItemsCenter.tsx` lines | 4,982 |
| `useState` in shell | 112 (useState token count; ~53 collection states) |
| `includeMetadataChanges` in `src` | **10** (all in `DelivereeWorkspace.tsx`) |
| `React.lazy` / `lazy(` in `src` | 0 |
| `onSnapshot(` in `src` | 142 |
| `tasks.filter(…projectId)` in ProjectSurfaces | **8+** in `ProjectCommandCenter` render |
| JS chunks | **1** app chunk |
| Largest JS | **4,272 KB** min / **1,073 KB** gzip |
| CSS | 728 KB / 114 KB gzip |

Root causes matched the audit: monolithic shell re-render on every snapshot,
metadata-change listener fan-out, unmemoized O(projects×tasks) aggregates,
and `manualChunks` rules that only matched pnpm paths under `npm ci`.

## After Steps 2 + 3 + 6 (this branch)

| Metric | Value |
| --- | ---: |
| `includeMetadataChanges` in `src` | **0** |
| `tasks.filter(…projectId)` in ProjectSurfaces | **0** (indexed via `tasksByProject`) |
| JS chunks | 10 vendor + app |
| Largest app JS | **2,179 KB** min / **578 KB** gzip |
| Vendor splits | firebase-*, react, charts, motion, icons |
| Total JS gzip (all chunks) | ~1,195 KB (still over budget until lazy routes) |

## Runtime (fill after browser run)

| Route | Long tasks (>50 ms) | Long-task ms | List paint ms | Shell commits | onSnapshot calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/home` | — | — | — | — | — |
| `/work/projects` | — | — | — | — | — |
| project page | — | — | — | — | — |
| `/my-work` | — | — | — | — | — |

## How to refresh

```bash
npm run build
node --import tsx scripts/perf-baseline.ts --write
```
