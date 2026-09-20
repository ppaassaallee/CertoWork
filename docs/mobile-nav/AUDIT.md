# Mobile nav — Dead-control audit

**Method:** Static code audit (Step 1.2 Playwright skipped — no Playwright in `package.json`; no automated login session). Assumption logged in ASSUMPTIONS.md.

Viewport target: 390×844 (documented decisions apply at phone widths).

| Route | Element | Problem | Decision | Commit |
|-------|---------|---------|----------|--------|
| /my-work | Try Daily Plan | Contrast / inert risk | **fix** MButton primary + `enableDailyPlan` | step 6–7 |
| /my-work | + View / Customize / toolbar / Select all | Desktop chrome | **remove** / View+Filter sheets | step 7–8 |
| /my-work | Dual tab rows | Duplicated | **remove** → Today·My items·Events | step 7 |
| / | Triage / Ask boxes / stats / zero line / activity | Noise | **remove** / Inbox Updates | step 6, 15 |
| /projects | Ask / Rutina / New project / 9 filters / table | Desktop | **remove** / cards + FAB + Filter sheet | step 10–11 |
| /projects | Timestamp( | Raw object | **fix** `formatDate` | step 11 |
| * | Hamburger / bell / chat / gear / Create pill | Overcrowded | **remove** on phone | step 4 |
| * | Chat Collab toggle | Drawer-only | **remove** with drawer | step 4–5 |
| create | ⌘ hints | Touch-hostile | **remove** | step 16 |
| /notes | Empty right pane | Desktop split | **remove** | step 14 |
| drawer entries | Duplicate tabs | — | **remove** | step 4 |

Step 19 sweep: every row has fix/remove/move-to; remaining live data wiring listed in REPORT follow-ups.
