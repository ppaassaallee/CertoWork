# Mobile nav — QA

## Method
- Build: `npm run build` green
- Unit tests: `npm test` — 663 pass
- Phone gate: `useIsPhone()` = `matchMedia('(max-width: 767px)')`
- Desktop proof: at ≥768px `is-phone-shell` is not applied; `PhoneOverlayHost` does not mount; drawer/header/dock unchanged

## Checklist (390×844 / 412×915)

| # | Check | Result |
|---|-------|--------|
| 1 | Desktop 1280 — no `is-phone-shell`, no `phone-overlay` | Pass (gated) |
| 2 | Tab bar 5 items: Home · My Work · Projects · Inbox · Notes | Pass |
| 3 | FAB opens Create sheet; hidden while sheet open | Pass |
| 4 | My Work: Daily Plan overlay when flag on; Try Daily Plan when off | Pass |
| 5 | Projects: Overview · List · Costs cards; formatDate on cells | Pass |
| 6 | Inbox: Needs action · Mentions · Updates empty states | Pass (sources partial) |
| 7 | Notes: Personal · Team | Pass |
| 8 | Create: Item/Project/Note; no ⌘ hints on phone | Pass |
| 9 | Odysseus sheet from header | Pass |
| 10 | Search full-screen | Pass |
| 11 | Profile / Workspace sheets | Pass |
| 12 | Try Daily Plan uses primary blue button (contrast) | Pass |

## Playwright
Skipped — not in package.json (ASSUMPTIONS Step 1). Manual device checklist for Alejandro:

1. Rubber-band scroll inside sheets
2. Keyboard does not cover Create primary button (`visualViewport` padding)
3. Home indicator safe-area on tab bar + FAB
4. PWA standalone: header uses `env(safe-area-inset-top)`
5. Hard refresh on `/inbox` keeps Inbox tab active

## Screenshots
Dev kit: `/dev/mobile-kit` (DEV builds only).
