# REPORT — Final (Daily Plan Phases 1–3)

## Visual reference
See [`MOCKUPS.md`](./MOCKUPS.md) — desktop + mobile HTML mockups (bucket tokens fire/growth/extra; semáforo stays R/Y/G).

## How to enable
- In-app: tap **Try Daily Plan** on My Work
- Firestore: `users/{yourUid}.flags.dailyPlan = true`
- Instant local: `localStorage.setItem('certoDailyPlan','1')` then refresh

## Deploy (pending auth)
See `docs/daily-plan/DEPLOY.md`. Rules must allow `users/{uid}.flags` (shipped with mobile follow-up).

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
Mobile follow-up: opt-in banner + compact My Work chrome when Daily Plan is on.
