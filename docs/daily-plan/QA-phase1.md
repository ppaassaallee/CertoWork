# QA — Phase 1 (Daily Plan)

Environment: production flag only on Alejandro’s uid. Rules deploy pending (`DEPLOY.md`).

| # | Check | Result |
|---|-------|--------|
| 1 | Flag off = no diff | `useDailyPlanEnabled` returns false → DelivereeWorkspace renders original `MyWorkViewsSurface` only. `WorkItemsCenter` diff is solely optional `renderRowExtra`. |
| 2 | Build + lint | `npm run build` pass; `npm run lint` 0 errors. |
| 3 | Rules | Rules committed; deploy blocked without firebase login — see DEPLOY.md. Logic: own uid R/W, delete false, id must match `uid_date`. |
| 4 | Idempotent add | `addEntry` no-ops if `itemId` already present. |
| 5 | Reorder | `moveEntry` renumbers every bucket 0..n-1. |
| 6 | Checkbox | Task → `completeItem` then `doneToday`; PBI/epic → `doneToday` only; Mark done in menu completes. |
| 7 | Start fresh | `localStorage.dailyPlanDateOverride` (DEV) empties today board; leftovers from prior plan. |
| 8 | Ghost | Missing item → ghost row + Remove. |
| 9 | Week strip | Past/future open read-only board + Back to today. |
| 10 | Mobile | Segmented My items / Today; drag via handle. |
| 11 | No doc on view | Doc created only on `addEntry` / first write. |

## Google OAuth (product question)

**Yes** — Firebase Google sign-in (`AuthContext`) + Calendar OAuth (`/api/calendar/oauth/google/*` in worker). Phase 2 uses separate GIS code-flow + Firebase callables for Daily Plan calendar column.
