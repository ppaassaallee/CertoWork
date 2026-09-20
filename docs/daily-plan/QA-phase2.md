# QA — Phase 2

| # | Check | Result |
|---|-------|--------|
| 1 | Flag off | Unchanged — overlay only mounts when `flags.dailyPlan` |
| 2 | Focus score | Unit test: growth done + fire open = 60; +key = 70 |
| 3 | Close day | CloseDaySheet Tomorrow/Leave/Drop + closedAt/note/score; Reopen clears closedAt |
| 4 | Plan tomorrow | Future `dateKey` editable; past read-only |
| 5 | Not configured | Events column + settings show env var names when GIS/client id missing |
| 6–9 | Google connect / tags | Code present; needs secrets deploy (DEPLOY.md) |
| 10 | Mobile Events tab | Segmented control includes Events |

Deploy blocked without firebase login.
