# Certo Work — performance remediation report

Branch: `cursor/perf-shell-isolation-7a36` (continues #202 / #203)  
Baseline: `docs/perf/BASELINE.md`

## Shipped

| Step | Change | Status |
| --- | --- | --- |
| 0 | New project create vs context intent; draft reset by project id | Done (#202) |
| 1 | `scripts/perf-baseline.ts` + `docs/perf/BASELINE.md` | Done (static/bundle only) |
| 2 | Removed all `includeMetadataChanges` | Done (0 in `src`) |
| 3 | Indexes + portfolio memos + `memo(ProjectCommandCenter)` | Done |
| 3 rem | `memo(ProjectRecordModal)`, `memo(ProjectConsolePanel)`, `memo(WorkItemsCenter)`, `memo(HomeCockpit)`, `memo(MyWorkOverview)` | Done |
| 4 | Collection stores + signature-stable `replaceAll`; `startWorkspaceData` owns core listeners; `applyDocChanges`; pack stores (`milestones`/`risks`/`invoices`/`tables`/…); `useProjectsWhen` / `useTasksWhen`; `subscribeProjectTasks`; selectors (`useOpenTaskCountByProject`, `useTask`, …) | Done (shell still bridges pack listeners + chrome; portfolio/home/project gate task arrays) |
| 5 | Lazy `ProjectsRoute`, `HomeRoute`, `ProjectRoute`, `MyWorkRoute` (non–daily-plan path), `ModalHost`/`uiStore`; lazy `BillingScreen` | Partial — shell still ~11k lines (target &lt;800); Settings/Odysseus/Notes/Tables/Collab routes not extracted |
| 6 | Vite vendor chunks | Done |
| 6 rem | Dynamic `import("recharts")` in ProgressDonut; lazy Billing; `xlsx` already dynamic in importService | Partial — War Room / `@google/genai` / CSS split still open; initial app JS near budget |
| 7 | Persistent Firestore cache; slim Projects listen packs | Done |
| 7.2 | Owner open-tasks-only query + `subscribeProjectTasks(projectId)`; composite indexes `tasks(workspaceId,status)` + `tasks(projectId,status)`; TablePage already per-`tableId` | Done (deploy indexes) |
| 8 | No client self-heal on load; Settings buttons kept | Done |
| 8 rem | Callable `restoreCreatorAssignees` + `scripts/backfill-creator-assignees.mjs`; Settings still on-demand entry (not GH-only) | Done (CF + script); pricing/followers remain Settings buttons |
| 9 | `perf-guards` in CI: `includeMetadataChanges`, chunk gzip, **fail** non-allowlisted `src` files &gt;1500 lines; warn `onSnapshot` outside `src/data/` | Done (no Playwright long-task / eslint exhaustives yet) |
| 10 | This report | Updated — live long-task / Lighthouse / Regina QA still pending |

## Architecture notes (Steps 4–5)

- **Portfolio / Home / Project**: shell sets `useTasksWhen(false)` so task snapshots do not re-render the shell; routes subscribe themselves.
- **Portfolio**: also `useProjectsWhen(false)`; `ProjectsRoute` owns projects+tasks.
- **Pack data**: deferred listeners still start from the shell but publish into `packStores` for route selectors.
- **My Work**: `MyWorkRoute` wired for the non–daily-plan path; DailyPlan overlay still uses inline `MyWorkViewsSurface` (shell keeps task subscription on `my-work`).

## Measured deltas (build)

| Metric | Before (#202 baseline) | After (this branch) |
| --- | ---: | ---: |
| App JS chunks | 1 × 4,272 KB (1,073 KB gz) | App ~578–592 KB gz + vendor splits (re-measure after lazy Billing/Home/Project) |
| `includeMetadataChanges` | 10 | 0 |
| Shell task sub on portfolio/home/project | always on | gated off |
| Live long tasks / Lighthouse / shell commits | — | **Pending** browser run |

## Manual QA (Regina / Pure AI)

- [ ] Home → Projects → project → My Work ×10 without “page unresponsive”
- [ ] Projects → **New project** → “Create project”, empty title (conversation linked to KruOps)
- [ ] Type in wizard while another user edits a project → draft stays
- [ ] Odysseus “update project X” still pre-fills
- [ ] Edit a task while Projects is open → no multi-second freeze
- [ ] Open project page → completed tasks appear (subscribeProjectTasks)
- [ ] Settings › Data: pricing sync / grant followers / restore creator assignees on demand
- [ ] Deploy Firestore indexes for open-tasks query

## Still next (shrink shell)

1. Extract remaining routes: Settings, OdysseusPanel, Notes, Tables, Collab, Agents, Approvals, Routines — move listeners fully into stores; shell &lt;800 lines.
2. Finish My Work daily-plan path on `MyWorkRoute`; gate shell tasks on `my-work`.
3. Playwright long-task CI gate + eslint `exhaustive-deps` + ban `onSnapshot` outside `src/data/`.
4. Record before/after long-task / Lighthouse numbers here.
