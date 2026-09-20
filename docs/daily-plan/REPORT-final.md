# REPORT — Final (Daily Plan Phases 1–3)

## Visual reference
See [`MOCKUPS.md`](./MOCKUPS.md) — desktop + mobile HTML mockups (bucket tokens fire/growth/extra; semáforo stays R/Y/G).

## How to enable
Firebase console: `users/{yourUid}.flags.dailyPlan = true`

## Deploy (pending auth)
See `docs/daily-plan/DEPLOY.md`.

## Assumptions
See `docs/daily-plan/ASSUMPTIONS.md` (full list).

## Phase summary
1. **Phase 1** — `dayPlans` model, Fires/Growth/Extras board, tray leftovers, week strip, flag-gated My Work overlay.
2. **Phase 2** — Focus score, close the day, plan tomorrow, Events column + Google connect callables/rules.
3. **Phase 3** — Heuristic “Plan my day”, proposal sheet, week summary, routines tick, Outlook stub.

## Key paths
- Feature: `src/features/dailyPlan/`
- Functions: `functions/`
- My Work touch: `DelivereeWorkspace` (flag gate), `WorkItemsCenter.renderRowExtra` only
- Mockups: `docs/daily-plan/mockup-desktop.html`, `mockup-mobile.html`

## Google OAuth already in product
Yes — Firebase Google sign-in + worker `/api/calendar/oauth/google/*`. Daily Plan calendar uses GIS code client + Firebase callables (separate from existing Integrations calendar).

## Stop
Phase 3 Step 33 complete. UI aligned to handed mockups for steps 6, 7, 9, 13, 17, 24.
