# Mobile nav — Final report

## What shipped
Phone-only shell (≤767px) with 5-tab bar, FAB, sheets, and rebuilt Home / My Work / Projects / Inbox / Notes. Desktop and tablet-landscape unchanged (`useIsPhone` gate).

## Files created
- `src/shared/useIsPhone.ts`, `src/shared/formatDate.ts`
- `src/styles/mobile-tokens.css`
- `src/mobile/ui/*` — MButton, MIconButton, MSegmented, MChip, MSheet, MListRow, MSectionHeader, MEmpty, MFab, MTabBar, MHeader
- `src/mobile/PhoneAppChrome.tsx`, `PhoneOverlayHost.tsx`, `phone-shell.css`, `MobileChromeContext.tsx`, `MobileKitPreview.tsx`
- `src/mobile/pages/Phone{Home,MyWork,Projects,Notes,Inbox,Search}.tsx`
- `src/mobile/sheets/{Create,Profile,Workspace,Odysseus}Sheet.tsx`
- `docs/mobile-nav/*`

## Files modified
- `src/components/DelivereeWorkspace.tsx` — phone overlay host
- `src/lib/delivereeRoutes.ts` — `/inbox` lens
- `src/App.tsx` — `/dev/mobile-kit`
- `package.json` — `react-swipeable`

## AUDIT decisions (summary)
| Element | Decision |
|---------|----------|
| Hamburger / drawer | Removed on phone |
| Bell / chat / gear / breadcrumb / black Create | Removed; → Inbox / Profile / FAB |
| Duplicated My Work tabs + toolbar | Removed; MSegmented + chips |
| Try Daily Plan contrast | Fixed → MButton primary + enableDailyPlan |
| Projects table / 9 filters | Cards + Filter sheet |
| Timestamp( | formatDate helper; PhoneProjects table uses it |
| Odysseus duplicates | Header icon + Odysseus sheet |
| Home noise (stats, zero line, activity) | Removed on phone Home |
| Mentions source missing | Empty state in Inbox |

## Assumptions
See `ASSUMPTIONS.md`.

## Follow-ups
- Wire Inbox rows to live `user_notifications` / approvals / activity feeds
- Full swipe-left action buttons + long-press multi-select parity with Asana
- Project detail / item detail dedicated phone layouts (Steps 12–13 logged as adapting existing)
- Deploy firestore rules if Daily Plan opt-in write still blocked on some tenants
- Playwright dead-control harness when Playwright is added to the repo

## Stop
Step 22 complete.
